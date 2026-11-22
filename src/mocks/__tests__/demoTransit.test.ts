import { createTransitStore, selectDepartureState, selectTransitFreshness } from "@/store/transitStore";

import { setMockTransitScenario } from "../demoTransit";
import { MOCK_DELAY_MS, mockTransitDeps } from "../mockStoreDeps";

const WALK_SPEED_M_PER_S = 1.3;

async function loadDemo() {
  const store = createTransitStore(mockTransitDeps);
  const loading = store.getState().load();
  await jest.advanceTimersByTimeAsync(MOCK_DELAY_MS * 2);
  await expect(loading).resolves.toBe(true);
  return store.getState();
}

describe("demo transit (E08)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-22T20:45:10Z"));
  });

  afterEach(() => {
    setMockTransitScenario("live");
    jest.useRealTimers();
  });

  it("live: fresh data with leave-now, delay, missed and leave-at rows", async () => {
    const state = await loadDemo();
    const now = new Date();

    expect(state.stops).toHaveLength(3);
    expect(selectTransitFreshness(state, now)?.isValid).toBe(true);
    expect(state.alerts).toHaveLength(1);

    const states = state.stops.flatMap((stop) =>
      (state.departures[stop.id] ?? []).map((d) =>
        selectDepartureState(d, Math.round(stop.distanceMeters / WALK_SPEED_M_PER_S), now),
      ),
    );
    expect(states).toEqual(expect.arrayContaining(["leaveNow", "later", "missed", "leaveAt"]));
  });

  it("timetable: data older than the TTL, no live delays", async () => {
    setMockTransitScenario("timetable");
    const state = await loadDemo();

    expect(selectTransitFreshness(state, new Date())?.isValid).toBe(false);
    const all = Object.values(state.departures).flat();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((d) => d.delaySeconds === null)).toBe(true);
  });
});
