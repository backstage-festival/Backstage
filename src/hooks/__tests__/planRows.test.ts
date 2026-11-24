import { PLAN_NOTE_HEIGHT } from "@/components/PlanNoteRow";
import type { Concert, FestivalEvent, Stage } from "@/domain/entities/Event";

import {
  buildPlanView,
  dayKeyOf,
  dayLabel,
  defaultDay,
  festivalDayOf,
  festivalDays,
  firstConflict,
  type PlanInput,
  planRowHeight,
  rowLayouts,
  stageCodesOf,
} from "../planRows";

const stage = (id: string, name: string): Stage => ({ id, eventId: "e", name, location: { latitude: 0, longitude: 0 } });
const stages = [stage("main", "Główna"), stage("docks", "Doki"), stage("tent", "Namiot Elektro")];

const concert = (id: string, stageId: string, startsAt: string, endsAt: string): Concert => ({
  id,
  eventId: "e",
  stageId,
  artist: id,
  startsAt,
  endsAt,
});

const played = concert("Biała Gorączka", "main", "2027-07-02T17:15:00+02:00", "2027-07-02T18:15:00+02:00");
const trio = concert("Bursztyn Trio", "docks", "2027-07-02T19:40:00+02:00", "2027-07-02T20:40:00+02:00");
const kuter = concert("Kuter", "tent", "2027-07-02T19:30:00+02:00", "2027-07-02T20:30:00+02:00");
const wilga = concert("Wilga i Fale", "main", "2027-07-02T20:15:00+02:00", "2027-07-02T21:30:00+02:00");
const hanna = concert("Hanna Sieradz", "docks", "2027-07-02T21:30:00+02:00", "2027-07-02T22:30:00+02:00");
const mewy = concert("Mewy Nocą", "main", "2027-07-02T22:15:00+02:00", "2027-07-02T23:30:00+02:00");
const saturday = concert("Sobota", "main", "2027-07-03T20:00:00+02:00", "2027-07-03T21:00:00+02:00");
const concerts = [played, trio, kuter, wilga, hanna, mewy, saturday];

const event: FestivalEvent = {
  id: "e",
  name: "Stocznia Sound",
  startsAt: "2027-07-02T14:00:00+02:00",
  endsAt: "2027-07-04T02:00:00+02:00",
  downloadedAt: null,
};

const now = new Date("2027-07-02T20:03:00+02:00");

const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  concerts,
  stages,
  plannedIds: new Set([trio.id, wilga.id, hanna.id, mewy.id]),
  days: festivalDays(event, concerts),
  filters: { day: null, scope: "all", stages: [] },
  now,
  playedExpanded: false,
  note: null,
  serial: "0702-S2-03",
  accentSuppressed: false,
  ...overrides,
});

describe("festival days", () => {
  it("lists festival days in Europe/Warsaw from start to end", () => {
    // Ends Sunday 02:00 – still Saturday's festival day.
    expect(festivalDays(event, [])).toEqual(["2027-07-02", "2027-07-03"]);
    expect(dayKeyOf("2027-07-02T23:30:00Z")).toBe("2027-07-03");
    expect(dayLabel("2027-07-02")).toBe("Pt 2.07");
    expect(dayLabel("2027-07-04")).toBe("Nd 4.07");
  });

  it("keeps concerts after midnight on the evening before (day starts at 06:00)", () => {
    expect(festivalDayOf("2027-07-03T00:30:00+02:00")).toBe("2027-07-02");
    expect(festivalDayOf("2027-07-03T05:59:00+02:00")).toBe("2027-07-02");
    expect(festivalDayOf("2027-07-03T06:00:00+02:00")).toBe("2027-07-03");

    const late = concert("Late", "main", "2027-07-03T00:30:00+02:00", "2027-07-03T01:30:00+02:00");
    const view = buildPlanView(input({ concerts: [...concerts, late] }));
    expect(view.rows.some((row) => row.key === "perf-Late")).toBe(true);
  });

  it("falls back to concert days without an event", () => {
    expect(festivalDays(null, [saturday, trio])).toEqual(["2027-07-02", "2027-07-03"]);
  });

  it("defaults to today, then the next festival day", () => {
    const days = ["2027-07-02", "2027-07-03"];
    expect(defaultDay(days, now)).toBe("2027-07-02");
    expect(defaultDay(days, new Date("2027-06-01T12:00:00Z"))).toBe("2027-07-02");
    expect(defaultDay(days, new Date("2027-07-03T12:00:00Z"))).toBe("2027-07-03");
    expect(defaultDay(days, new Date("2027-08-01T12:00:00Z"))).toBe("2027-07-02");
    expect(defaultDay([], now)).toBeNull();
  });
});

describe("stages and conflicts", () => {
  it("codes stages S1–S3 by line-up order", () => {
    expect(stageCodesOf(stages)).toEqual({ main: "s1", docks: "s2", tent: "s3" });
  });

  it("finds the first overlapping planned concert with the domain rule", () => {
    expect(firstConflict(hanna, [wilga, mewy])).toBe(mewy);
    expect(firstConflict(wilga, [hanna])).toBeUndefined(); // ends exactly when the other starts
  });

  it("never throws for a concert with a broken time range", () => {
    const broken = { ...hanna, endsAt: "not a date" };
    expect(firstConflict(broken, [mewy])).toBeUndefined();
  });
});

describe("buildPlanView", () => {
  it("splits the day into TERAZ, DALEJ and a collapsed ZAGRANE row", () => {
    const view = buildPlanView(input());

    expect(view.day).toBe("2027-07-02");
    expect(view.nowPass).toMatchObject({ id: trio.id, remainingMin: 37, inPlan: true, alsoNow: "Kuter · S3" });
    expect(view.rows.map((row) => row.key)).toEqual([
      "header-next",
      `perf-${wilga.id}`,
      `perf-${hanna.id}`,
      `perf-${mewy.id}`,
      "played",
    ]);
    expect(view.empty).toBeNull();
    expect(view.dayCount).toBe(6);
  });

  it("marks conflicting planned concerts", () => {
    const view = buildPlanView(input());
    const cards = view.rows.flatMap((row) => (row.type === "perf" ? [row.card] : []));
    expect(cards.find((card) => card.id === hanna.id)).toMatchObject({ state: "conflict", statusLine: "Kolizja · S1 od 22:15" });
    // Wilga i Fale starts while the planned Bursztyn Trio still plays.
    expect(cards.find((card) => card.id === wilga.id)).toMatchObject({ state: "conflict", statusLine: "Kolizja · S2 od 19:40" });
    expect(buildPlanView(input({ plannedIds: new Set([wilga.id]) })).rows[1]).toMatchObject({ card: { state: "inPlan" } });
  });

  it("expands played concerts", () => {
    const view = buildPlanView(input({ playedExpanded: true }));
    expect(view.rows.at(-1)).toMatchObject({ type: "perf", card: { id: played.id, state: "played" } });
  });

  it("filters by „Mój plan” and stages", () => {
    const mine = buildPlanView(input({ filters: { day: null, scope: "mine", stages: ["s1"] } }));
    expect(mine.nowPass).toBeNull();
    expect(mine.rows.filter((row) => row.type === "perf").map((row) => row.key)).toEqual([`perf-${wilga.id}`, `perf-${mewy.id}`]);
  });

  it("tells an empty plan from an empty stage filter", () => {
    const nothingPlanned = input({ plannedIds: new Set(), filters: { day: null, scope: "mine", stages: [] } });
    expect(buildPlanView(nothingPlanned).empty).toBe("noPlan");

    const noShow = input({
      concerts: [trio],
      filters: { day: null, scope: "all", stages: ["s3"] },
    });
    expect(buildPlanView(noShow).empty).toBe("noConcerts");
  });

  it("puts a write error under its card, or first when the card is not listed", () => {
    const note = {
      concertId: hanna.id,
      label: "Nie zapisano",
      accessibilityLabel: "Nie zapisano",
      tone: "error",
      allowConflict: false,
    } as const;
    const keys = buildPlanView(input({ note })).rows.map((row) => row.key);
    expect(keys.indexOf(`note-${hanna.id}`)).toBe(keys.indexOf(`perf-${hanna.id}`) + 1);

    const onPass = { ...note, concertId: trio.id };
    expect(buildPlanView(input({ note: onPass })).rows[0]).toMatchObject({ type: "note", key: `note-${trio.id}` });
  });
});

describe("row layouts", () => {
  it("adds fixed heights (L-Listy) into offsets", () => {
    const rows = buildPlanView(input()).rows;
    const layouts = rowLayouts(rows, planRowHeight);
    // header 46, three conflicting cards 114 each, played 49
    expect(layouts.map((layout) => layout.length)).toEqual([46, 114, 114, 114, 49]);
    expect(layouts.map((layout) => layout.offset)).toEqual([0, 46, 160, 274, 388]);

    const note = {
      concertId: hanna.id,
      label: "Kolizja · S1 od 01:30",
      accessibilityLabel: "Kolizja z Mewy Nocą, scena 1 Główna, od 01:30",
      tone: "warning",
      allowConflict: true,
    } as const;
    const withNote = rowLayouts(buildPlanView(input({ note })).rows, planRowHeight);
    // header, Wilga, Hanna, note (8 + 22 + 8 + 48 + 8 = 94), Mewy, played
    expect(withNote.map((layout) => layout.length)).toEqual([46, 114, 114, PLAN_NOTE_HEIGHT, 114, 49]);
    expect(PLAN_NOTE_HEIGHT).toBe(94);
    expect(withNote[4]?.offset).toBe(46 + 114 + 114 + 94);

    const plain = rowLayouts(buildPlanView(input({ plannedIds: new Set() })).rows, planRowHeight);
    expect(plain.map((layout) => layout.length)).toEqual([46, 86, 86, 86, 49]);
  });
});
