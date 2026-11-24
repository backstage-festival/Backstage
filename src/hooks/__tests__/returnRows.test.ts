import type { Departure } from "@/domain/entities/Transit";
import { selectDepartureState, selectUpcomingDepartures } from "@/store/transitStore";
import type { NearbyStop } from "@/use-cases/GetNearbyStopsUseCase";

import { rowLayouts } from "../planRows";
import { ageParts, buildReturnRows, type ReturnRowsInput, returnRowHeight } from "../returnRows";

const stop = (id: number, name: string, distanceMeters: number): NearbyStop => ({
  id,
  name,
  location: { latitude: 0, longitude: 0 },
  distanceMeters,
});

const departure = (stopId: number, routeName: string, departureAt: string, delaySeconds: number | null = 0): Departure => ({
  stopId,
  routeName,
  headsign: "Gdynia Główna",
  departureAt,
  delaySeconds,
  fetchedAt: "2027-07-02T21:40:00+02:00",
});

const plac = stop(1, "Plac Solidarności", 300);
const skm = stop(2, "Stocznia SKM", 600);
const empty = stop(3, "Pusty", 100);

const input = (overrides: Partial<ReturnRowsInput> = {}): ReturnRowsInput => ({
  stops: [empty, plac, skm],
  departures: {
    1: [departure(1, "2", "2027-07-02T21:49:00+02:00"), departure(1, "6", "2027-07-02T22:03:00+02:00", 300)],
    2: [departure(2, "SKM", "2027-07-02T21:52:00+02:00"), departure(2, "SKM", "2027-07-02T22:07:00+02:00")],
    3: [departure(3, "9", "2027-07-02T21:00:00+02:00")],
  },
  now: new Date("2027-07-02T21:45:00+02:00"),
  timetableOnly: false,
  upcoming: selectUpcomingDepartures,
  stateOf: selectDepartureState,
  ...overrides,
});

describe("buildReturnRows", () => {
  it("flattens stops and their departures, skipping stops with nothing left", () => {
    const rows = buildReturnRows(input());
    expect(rows.map((row) => row.type)).toEqual(["stop", "departure", "departure", "stop", "departure", "departure"]);
    expect(rows[0]).toMatchObject({ header: { name: "Plac Solidarności", meta: "300 m · 4 min", freshness: "live", first: true } });
    expect(rows[3]).toMatchObject({ header: { name: "Stocznia SKM", first: false } });
  });

  it("uses the selector state per row („Nie zdążysz” kept until departure)", () => {
    const states = buildReturnRows(input()).flatMap((row) => (row.type === "departure" ? [row.row.state] : []));
    expect(states).toEqual(["leaveNow", "later", "missed", "leaveAt"]);
  });

  it("spells out SKM on the first SKM row of a stop only", () => {
    const skmRows = buildReturnRows(input()).filter((row) => row.type === "departure" && row.row.kind === "skm");
    expect(skmRows.map((row) => row.type === "departure" && row.row.spellOutKind)).toEqual([true, false]);
  });

  it("switches to the timetable when data is older than the TTL", () => {
    const rows = buildReturnRows(input({ timetableOnly: true }));
    expect(rows[0]).toMatchObject({ header: { freshness: "stale" } });
    expect(rows[2]).toMatchObject({ row: { time: "22:03", freshness: "stale" } });
  });

  it("has fixed heights: stop 35 then 45, departure 57", () => {
    const layouts = rowLayouts(buildReturnRows(input()), returnRowHeight);
    expect(layouts.map((layout) => layout.length)).toEqual([35, 57, 57, 45, 57, 57]);
    expect(layouts.at(-1)?.offset).toBe(35 + 57 + 57 + 45 + 57);
  });
});

describe("ageParts", () => {
  it("splits the data age into hours and minutes", () => {
    expect(ageParts(130 * 60_000)).toEqual({ hours: 2, minutes: 10 });
    expect(ageParts(9 * 60_000 + 59_000)).toEqual({ hours: 0, minutes: 9 });
    expect(ageParts(-1)).toEqual({ hours: 0, minutes: 0 });
  });
});
