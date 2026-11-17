import type { SupabaseClient } from "@supabase/supabase-js";

import type { OutboxMessage } from "../../../domain/entities/OutboxMessage";
import { SupabaseMessageGateway } from "../SupabaseMessageGateway";

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface FakeOptions {
  sessionUserId?: string | null;
  anonymous?: { userId: string | null; error: { message: string } | null };
  upsertResult?: QueryResult;
  selectResult?: QueryResult;
}

/**
 * Atrapa klienta Supabase dla tabeli messages i logowania anonimowego.
 * Zapamietuje wywolania, zeby test mogl sprawdzic, co poszlo do bazy.
 */
function fakeSupabase(options: FakeOptions = {}) {
  const upsert = jest.fn(() =>
    Promise.resolve(options.upsertResult ?? { data: null, error: null }),
  );
  const filters: { method: string; column: string; value: unknown }[] = [];

  const selectResult = options.selectResult ?? { data: [], error: null };
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push({ method: "eq", column, value });
      return builder;
    },
    gt: (column: string, value: unknown) => {
      filters.push({ method: "gt", column, value });
      return builder;
    },
    order: () => builder,
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(selectResult).then(resolve, reject),
  };

  const sessionUserId = options.sessionUserId ?? null;
  const anonymous = options.anonymous ?? { userId: "anon-1", error: null };
  const signInAnonymously = jest.fn(() =>
    Promise.resolve({
      data: { user: anonymous.userId === null ? null : { id: anonymous.userId } },
      error: anonymous.error,
    }),
  );

  const supabase = {
    from: jest.fn(() => ({ ...builder, upsert })),
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: sessionUserId === null ? null : { user: { id: sessionUserId } } },
        }),
      ),
      signInAnonymously,
    },
  } as unknown as SupabaseClient;

  return { supabase, upsert, filters, signInAnonymously };
}

const message: OutboxMessage = {
  id: "m1",
  crewId: "crew-1",
  authorId: "local-user-1",
  body: "Jestesmy pod scena Dzwig",
  status: "queued",
  attempts: 2,
  createdAt: "2027-08-13T18:05:00.000Z",
  nextAttemptAt: "2027-08-13T18:06:00.000Z",
  sentAt: null,
};

const messageRow = {
  id: "m2",
  crew_id: "crew-1",
  author_id: "anon-2",
  body: "Idziemy po wode",
  created_at: "2027-08-13T18:10:00+00:00",
  sent_at: "2027-08-13T18:10:03+00:00",
};

describe("SupabaseMessageGateway.send", () => {
  it("wysyła wiadomość jako zalogowany użytkownik Supabase, bez duplikatów", async () => {
    const { supabase, upsert, signInAnonymously } = fakeSupabase({ sessionUserId: "anon-1" });

    await new SupabaseMessageGateway(supabase).send(message);

    expect(upsert).toHaveBeenCalledWith(
      {
        id: "m1",
        crew_id: "crew-1",
        author_id: "anon-1",
        body: "Jestesmy pod scena Dzwig",
        created_at: "2027-08-13T18:05:00.000Z",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("loguje anonimowo, gdy telefon nie ma jeszcze sesji", async () => {
    const { supabase, upsert, signInAnonymously } = fakeSupabase({
      sessionUserId: null,
      anonymous: { userId: "anon-new", error: null },
    });

    await new SupabaseMessageGateway(supabase).send(message);

    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: "anon-new" }),
      expect.anything(),
    );
  });

  it("rzuca HTTP, gdy logowanie anonimowe się nie uda", async () => {
    const { supabase, upsert } = fakeSupabase({
      sessionUserId: null,
      anonymous: { userId: null, error: { message: "anonymous sign-ins are disabled" } },
    });

    await expect(new SupabaseMessageGateway(supabase).send(message)).rejects.toMatchObject({
      code: "HTTP",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rzuca HTTP z opisem, gdy Supabase odrzuci zapis", async () => {
    const { supabase } = fakeSupabase({
      sessionUserId: "anon-1",
      upsertResult: { data: null, error: { message: "new row violates row-level security policy" } },
    });

    const error = await new SupabaseMessageGateway(supabase)
      .send(message)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "HTTP" });
    expect((error as Error).message).toContain("row-level security");
  });
});

describe("SupabaseMessageGateway.fetchForCrew", () => {
  it("zamienia wiersze z bazy na wysłane wiadomości", async () => {
    const { supabase } = fakeSupabase({ selectResult: { data: [messageRow], error: null } });

    await expect(
      new SupabaseMessageGateway(supabase).fetchForCrew("crew-1", null),
    ).resolves.toEqual([
      {
        id: "m2",
        crewId: "crew-1",
        authorId: "anon-2",
        body: "Idziemy po wode",
        status: "sent",
        attempts: 0,
        createdAt: "2027-08-13T18:10:00.000Z",
        nextAttemptAt: null,
        sentAt: "2027-08-13T18:10:03.000Z",
      },
    ]);
  });

  it("bez daty pobiera wszystko, z datą tylko nowsze wiadomości", async () => {
    const all = fakeSupabase();
    const newer = fakeSupabase();

    await new SupabaseMessageGateway(all.supabase).fetchForCrew("crew-1", null);
    await new SupabaseMessageGateway(newer.supabase).fetchForCrew(
      "crew-1",
      "2027-08-13T18:00:00.000Z",
    );

    expect(all.filters).toEqual([{ method: "eq", column: "crew_id", value: "crew-1" }]);
    expect(newer.filters).toEqual([
      { method: "eq", column: "crew_id", value: "crew-1" },
      { method: "gt", column: "created_at", value: "2027-08-13T18:00:00.000Z" },
    ]);
  });

  it("pomija zepsute wiersze", async () => {
    const { supabase } = fakeSupabase({
      selectResult: {
        data: [messageRow, { ...messageRow, id: "m3", body: "" }, { ...messageRow, sent_at: null }, 7],
        error: null,
      },
    });

    const messages = await new SupabaseMessageGateway(supabase).fetchForCrew("crew-1", null);

    expect(messages.map((m) => m.id)).toEqual(["m2"]);
  });

  it("rzuca HTTP, gdy Supabase zwróci błąd, i PARSE, gdy zamiast listy przyjdzie coś innego", async () => {
    const failing = fakeSupabase({ selectResult: { data: null, error: { message: "timeout" } } });
    const broken = fakeSupabase({ selectResult: { data: { nie: "lista" }, error: null } });

    await expect(
      new SupabaseMessageGateway(failing.supabase).fetchForCrew("crew-1", null),
    ).rejects.toMatchObject({ code: "HTTP" });
    await expect(
      new SupabaseMessageGateway(broken.supabase).fetchForCrew("crew-1", null),
    ).rejects.toMatchObject({ code: "PARSE" });
  });
});
