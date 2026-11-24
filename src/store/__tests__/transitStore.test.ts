import type { Departure, TransitAlert } from "@/domain/entities/Transit";
import { DomainError } from "@/domain/errors/DomainError";
import type { GetNearbyStopsInput, NearbyStop } from "@/use-cases/GetNearbyStopsUseCase";

import { deferred } from "../testing/deferred";
import {
  createTransitStore,
  selectDepartureState,
  selectTransitFreshness,
  selectUpcomingDepartures,
  type TransitStoreDeps,
} from "../transitStore";

const stop = (id: number, distanceMeters: number): NearbyStop => ({
  id,
  name: `Stop ${id}`,
  location: { latitude: 0, longitude: 0 },
  distanceMeters,
});

const departure = (stopId: number, departureAt: string, overrides: Partial<Departure> = {}): Departure => ({
  stopId,
  routeName: "2",
  headsign: "Oliwa",
  departureAt,
  delaySeconds: 0,
  fetchedAt: "2027-07-02T21:40:00+02:00",
  ...overrides,
});

const alert: TransitAlert = {
  id: "a1",
  title: "Tramwaje 2 i 6",
  body: "Objazd",
  validFrom: "2027-07-02T20:00:00+02:00",
  validTo: null,
  fetchedAt: "2027-07-02T21:40:00+02:00",
};

describe("transitStore", () => {
  const makeDeps = () => ({
    getNearbyStops: { execute: jest.fn<Promise<NearbyStop[]>, [GetNearbyStopsInput?]>() },
    loadDepartures: jest.fn<Promise<readonly Departure[]>, [readonly number[]]>(),
    loadAlerts: jest.fn<Promise<readonly TransitAlert[]>, []>(),
  });
  let deps: ReturnType<typeof makeDeps>;

  const withData = () => {
    deps.getNearbyStops.execute.mockResolvedValueOnce([stop(1, 300), stop(2, 600)]);
    deps.loadDepartures.mockResolvedValueOnce([
      departure(1, "2027-07-02T22:03:00+02:00", { fetchedAt: "2027-07-02T21:38:00+02:00" }),
      departure(1, "2027-07-02T21:49:00+02:00"),
      departure(2, "2027-07-02T21:52:00+02:00", { routeName: "SKM" }),
    ]);
    deps.loadAlerts.mockResolvedValueOnce([alert]);
  };

  beforeEach(() => {
    deps = makeDeps();
  });

  it("loads stops, departures by stop (earliest first), alerts and the data age", async () => {
    withData();
    const store = createTransitStore(deps satisfies TransitStoreDeps);

    const loading = store.getState().load();
    expect(store.getState().loadStatus).toBe("loading");
    await expect(loading).resolves.toBe(true);

    expect(deps.loadDepartures).toHaveBeenCalledWith([1, 2]);
    const state = store.getState();
    expect(state.stops.map((s) => s.id)).toEqual([1, 2]);
    expect(state.departures[1]?.map((d) => d.departureAt)).toEqual(["2027-07-02T21:49:00+02:00", "2027-07-02T22:03:00+02:00"]);
    expect(state.departures[2]).toHaveLength(1);
    expect(state.alerts).toEqual([alert]);
    // The oldest fetchedAt – the screen never claims newer data than it has.
    expect(state.asOf).toBe("2027-07-02T21:38:00+02:00");
    expect(state).toMatchObject({ loadStatus: "ready", lastError: null });
  });

  it("reports a missing location and keeps cached data", async () => {
    withData();
    const store = createTransitStore(deps);
    await store.getState().load();
    deps.getNearbyStops.execute.mockRejectedValueOnce(new DomainError("LOCATION_UNAVAILABLE", "No GPS."));

    await expect(store.getState().load()).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ loadStatus: "error", lastError: { kind: "locationUnavailable" } });
    expect(store.getState().stops).toHaveLength(2);
  });

  it("reports any other failure as loadFailed", async () => {
    deps.getNearbyStops.execute.mockResolvedValueOnce([stop(1, 300)]);
    deps.loadDepartures.mockRejectedValueOnce(new Error("db"));
    deps.loadAlerts.mockResolvedValueOnce([]);
    const store = createTransitStore(deps);

    await expect(store.getState().load()).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ loadStatus: "error", lastError: { kind: "loadFailed" }, stops: [] });
  });

  it("ignores an older response that settles after a newer one", async () => {
    const older = deferred<NearbyStop[]>();
    deps.getNearbyStops.execute.mockReturnValueOnce(older.promise).mockResolvedValueOnce([stop(2, 600)]);
    deps.loadDepartures.mockResolvedValue([]);
    deps.loadAlerts.mockResolvedValue([]);
    const store = createTransitStore(deps);

    const first = store.getState().load();
    await expect(store.getState().load()).resolves.toBe(true);
    older.resolve([stop(1, 300)]);
    await expect(first).resolves.toBe(false);

    expect(store.getState().stops.map((s) => s.id)).toEqual([2]);
  });

  it("ignores an older failure that settles after a newer success", async () => {
    const older = deferred<NearbyStop[]>();
    deps.getNearbyStops.execute.mockReturnValueOnce(older.promise).mockResolvedValueOnce([stop(2, 600)]);
    deps.loadDepartures.mockResolvedValue([]);
    deps.loadAlerts.mockResolvedValue([]);
    const store = createTransitStore(deps);

    const first = store.getState().load();
    await store.getState().load();
    older.reject(new Error("late"));
    await expect(first).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ loadStatus: "ready", lastError: null });
  });

  it("reset() returns to the initial state and drops a late response", async () => {
    const pending = deferred<NearbyStop[]>();
    deps.getNearbyStops.execute.mockReturnValueOnce(pending.promise);
    deps.loadDepartures.mockResolvedValue([departure(1, "2027-07-02T21:49:00+02:00")]);
    deps.loadAlerts.mockResolvedValue([alert]);
    const store = createTransitStore(deps);

    const loading = store.getState().load();
    store.getState().reset();
    pending.resolve([stop(1, 300)]);
    await expect(loading).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ stops: [], departures: {}, alerts: [], asOf: null, loadStatus: "idle", lastError: null });
  });
});

describe("transit selectors", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("selectTransitFreshness (domain TTL for departures: 10 min)", () => {
    it("is valid before the TTL and stale after it", () => {
      const asOf = "2027-07-02T21:40:00+02:00";

      jest.setSystemTime(new Date("2027-07-02T21:49:59+02:00"));
      expect(selectTransitFreshness({ asOf })).toMatchObject({ isValid: true, ageMs: 9 * 60_000 + 59_000 });

      jest.setSystemTime(new Date("2027-07-02T21:50:00+02:00"));
      expect(selectTransitFreshness({ asOf })?.isValid).toBe(false);
    });

    it("is unknown without data or with a broken date (never throws)", () => {
      expect(selectTransitFreshness({ asOf: null })).toBeNull();
      expect(selectTransitFreshness({ asOf: "yesterday" })).toBeNull();
    });
  });

  describe("selectDepartureState („Nie zdążysz”)", () => {
    // 300 m at 1.3 m/s ≈ 231 s of walking.
    const walk = 231;
    const tram = departure(1, "2027-07-02T21:49:00+02:00");

    it("moves from later to leaveAt, leaveNow and missed as the clock runs", () => {
      jest.setSystemTime(new Date("2027-07-02T21:20:00+02:00"));
      expect(selectDepartureState(tram, walk)).toBe("later");

      jest.setSystemTime(new Date("2027-07-02T21:35:00+02:00"));
      expect(selectDepartureState(tram, walk)).toBe("leaveAt");

      jest.setSystemTime(new Date("2027-07-02T21:44:30+02:00"));
      expect(selectDepartureState(tram, walk)).toBe("leaveNow");

      jest.setSystemTime(new Date("2027-07-02T21:46:00+02:00"));
      expect(selectDepartureState(tram, walk)).toBe("missed");
    });

    it("counts the delay unless only the timetable is trusted", () => {
      const late = { ...tram, delaySeconds: 300 };
      jest.setSystemTime(new Date("2027-07-02T21:46:00+02:00"));
      expect(selectDepartureState(late, walk)).toBe("leaveAt");
      expect(selectDepartureState(late, walk, new Date(), true)).toBe("missed");
    });
  });

  describe("selectUpcomingDepartures", () => {
    it("keeps a missed row until the vehicle leaves, then drops it", () => {
      const tram = departure(1, "2027-07-02T21:49:00+02:00");

      jest.setSystemTime(new Date("2027-07-02T21:48:59+02:00"));
      expect(selectUpcomingDepartures([tram])).toEqual([tram]);

      jest.setSystemTime(new Date("2027-07-02T21:49:01+02:00"));
      expect(selectUpcomingDepartures([tram])).toEqual([]);
    });

    it("uses the delayed time for live data and drops broken dates", () => {
      const late = departure(1, "2027-07-02T21:49:00+02:00", { delaySeconds: 120 });
      const broken = departure(1, "not a date");
      jest.setSystemTime(new Date("2027-07-02T21:50:00+02:00"));
      expect(selectUpcomingDepartures([late, broken])).toEqual([late]);
    });
  });
});
