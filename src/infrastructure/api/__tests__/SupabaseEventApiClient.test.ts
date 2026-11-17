import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseEventApiClient } from "../SupabaseEventApiClient";

const EVENT_ID = "e1";

interface TableResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Atrapa klienta Supabase: from(tabela).select().eq().order().maybeSingle()
 * zwraca przygotowany wynik i zapamietuje, o co pytano.
 */
function fakeSupabase(tables: Record<string, TableResult>) {
  const calls: { table: string; column: string; value: unknown }[] = [];

  const from = jest.fn((table: string) => {
    const result = tables[table] ?? { data: [], error: null };
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        calls.push({ table, column, value });
        return builder;
      },
      order: () => builder,
      maybeSingle: () => Promise.resolve(result),
      then: (
        resolve: (value: TableResult) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });

  const supabase = { from } as unknown as SupabaseClient;
  return { supabase, calls };
}

const eventRow = {
  id: EVENT_ID,
  name: "Stocznia Sound 2027",
  starts_at: "2027-08-13T14:00:00+00:00",
  ends_at: "2027-08-15T22:00:00+00:00",
};
const stageRow = {
  id: "s1",
  event_id: EVENT_ID,
  name: "Scena Dzwig",
  latitude: 54.3635,
  longitude: 18.6488,
};
const concertRow = {
  id: "c1",
  event_id: EVENT_ID,
  stage_id: "s1",
  artist: "Zespol A",
  starts_at: "2027-08-13T18:00:00+00:00",
  ends_at: "2027-08-13T19:00:00+00:00",
};
const poiRow = {
  id: "p1",
  event_id: EVENT_ID,
  type: "water",
  name: "Punkt wody",
  latitude: 54.364,
  longitude: 18.649,
};

function okTables(overrides: Partial<Record<string, TableResult>> = {}) {
  return {
    events: { data: eventRow, error: null },
    stages: { data: [stageRow], error: null },
    concerts: { data: [concertRow], error: null },
    pois: { data: [poiRow], error: null },
    ...overrides,
  } as Record<string, TableResult>;
}

describe("SupabaseEventApiClient.fetchEventPackage", () => {
  it("składa paczkę eventu z czterech tabel i zamienia nazwy pól na encje", async () => {
    const { supabase } = fakeSupabase(okTables());
    const client = new SupabaseEventApiClient(supabase);

    await expect(client.fetchEventPackage(EVENT_ID)).resolves.toEqual({
      event: {
        id: EVENT_ID,
        name: "Stocznia Sound 2027",
        startsAt: "2027-08-13T14:00:00.000Z",
        endsAt: "2027-08-15T22:00:00.000Z",
        downloadedAt: null,
      },
      stages: [
        {
          id: "s1",
          eventId: EVENT_ID,
          name: "Scena Dzwig",
          location: { latitude: 54.3635, longitude: 18.6488 },
        },
      ],
      concerts: [
        {
          id: "c1",
          eventId: EVENT_ID,
          stageId: "s1",
          artist: "Zespol A",
          startsAt: "2027-08-13T18:00:00.000Z",
          endsAt: "2027-08-13T19:00:00.000Z",
        },
      ],
      pois: [
        {
          id: "p1",
          eventId: EVENT_ID,
          type: "water",
          name: "Punkt wody",
          location: { latitude: 54.364, longitude: 18.649 },
        },
      ],
    });
  });

  it("pyta każdą tabelę tylko o wybrany event", async () => {
    const { supabase, calls } = fakeSupabase(okTables());

    await new SupabaseEventApiClient(supabase).fetchEventPackage(EVENT_ID);

    expect(calls).toEqual(
      expect.arrayContaining([
        { table: "events", column: "id", value: EVENT_ID },
        { table: "stages", column: "event_id", value: EVENT_ID },
        { table: "concerts", column: "event_id", value: EVENT_ID },
        { table: "pois", column: "event_id", value: EVENT_ID },
      ]),
    );
  });

  it("pomija zepsute wiersze scen, koncertów i POI", async () => {
    const { supabase } = fakeSupabase(
      okTables({
        stages: {
          data: [stageRow, { ...stageRow, id: "s2", latitude: null }, null],
          error: null,
        },
        concerts: {
          data: [
            concertRow,
            { ...concertRow, id: "c2", artist: "" },
            { ...concertRow, id: "c3", ends_at: "2027-08-13T17:00:00+00:00" },
          ],
          error: null,
        },
        pois: {
          data: [poiRow, { ...poiRow, id: "p2", type: "bar" }, "smieci"],
          error: null,
        },
      }),
    );

    const result = await new SupabaseEventApiClient(supabase).fetchEventPackage(EVENT_ID);

    expect(result.stages.map((s) => s.id)).toEqual(["s1"]);
    expect(result.concerts.map((c) => c.id)).toEqual(["c1"]);
    expect(result.pois.map((p) => p.id)).toEqual(["p1"]);
  });

  it("pomija koncert na scenie, której nie ma w paczce", async () => {
    const { supabase } = fakeSupabase(
      okTables({
        concerts: {
          data: [concertRow, { ...concertRow, id: "c2", stage_id: "nieznana" }],
          error: null,
        },
      }),
    );

    const result = await new SupabaseEventApiClient(supabase).fetchEventPackage(EVENT_ID);

    expect(result.concerts.map((c) => c.id)).toEqual(["c1"]);
  });

  it("rzuca HTTP, gdy eventu nie ma w bazie", async () => {
    const { supabase } = fakeSupabase(okTables({ events: { data: null, error: null } }));

    await expect(
      new SupabaseEventApiClient(supabase).fetchEventPackage(EVENT_ID),
    ).rejects.toMatchObject({ code: "HTTP" });
  });

  it("rzuca PARSE, gdy wiersz eventu jest zepsuty", async () => {
    const { supabase } = fakeSupabase(
      okTables({ events: { data: { ...eventRow, starts_at: "jutro" }, error: null } }),
    );

    await expect(
      new SupabaseEventApiClient(supabase).fetchEventPackage(EVENT_ID),
    ).rejects.toMatchObject({ code: "PARSE" });
  });

  it("rzuca HTTP z nazwą tabeli, gdy Supabase zwróci błąd", async () => {
    const { supabase } = fakeSupabase(
      okTables({ pois: { data: null, error: { message: "permission denied" } } }),
    );

    const error = await new SupabaseEventApiClient(supabase)
      .fetchEventPackage(EVENT_ID)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "HTTP" });
    expect((error as Error).message).toContain("pois");
    expect((error as Error).message).toContain("permission denied");
  });

  it("rzuca PARSE, gdy zamiast listy przyjdzie coś innego", async () => {
    const { supabase } = fakeSupabase(
      okTables({ stages: { data: { nie: "lista" }, error: null } }),
    );

    await expect(
      new SupabaseEventApiClient(supabase).fetchEventPackage(EVENT_ID),
    ).rejects.toMatchObject({ code: "PARSE" });
  });
});
