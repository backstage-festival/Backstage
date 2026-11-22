import type { Concert, FestivalEvent, Stage } from "@/domain/entities/Event";

import { createLineupStore, type Lineup, type LineupStoreDeps, selectHasLineup } from "../lineupStore";
import { deferred } from "../testing/deferred";

const event: FestivalEvent = {
  id: "event-1",
  name: "Stocznia Sound",
  startsAt: "2027-07-02T12:00:00Z",
  endsAt: "2027-07-04T00:00:00Z",
  downloadedAt: "2027-07-02T12:05:00Z",
};

const stage: Stage = { id: "s1", eventId: "event-1", name: "Główna", location: { latitude: 0, longitude: 0 } };

const concert = (id: string): Concert => ({
  id,
  eventId: "event-1",
  stageId: "s1",
  artist: id,
  startsAt: "2027-07-02T18:00:00Z",
  endsAt: "2027-07-02T19:00:00Z",
});

const lineup = (...ids: string[]): Lineup => ({ event, stages: [stage], concerts: ids.map(concert) });

describe("lineupStore", () => {
  const makeDeps = () => ({ loadLineup: jest.fn<Promise<Lineup>, [string]>() });
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("loads concerts and stages of the event", async () => {
    deps.loadLineup.mockResolvedValueOnce(lineup("c1", "c2"));
    const store = createLineupStore(deps satisfies LineupStoreDeps);

    const loading = store.getState().load("event-1");
    expect(store.getState().loadStatus).toBe("loading");
    await expect(loading).resolves.toBe(true);

    expect(deps.loadLineup).toHaveBeenCalledWith("event-1");
    expect(store.getState()).toMatchObject({ eventId: "event-1", event, stages: [stage], loadStatus: "ready", lastError: null });
    expect(store.getState().concerts.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(selectHasLineup(store.getState())).toBe(true);
  });

  it("sets an error and keeps cached data of the same event", async () => {
    deps.loadLineup.mockResolvedValueOnce(lineup("c1")).mockRejectedValueOnce(new Error("db"));
    const store = createLineupStore(deps);
    await store.getState().load("event-1");

    await expect(store.getState().load("event-1")).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ loadStatus: "error", lastError: { kind: "loadFailed" } });
    expect(store.getState().concerts).toHaveLength(1);
  });

  it("clears data of another event before loading", async () => {
    deps.loadLineup.mockResolvedValueOnce(lineup("c1"));
    const store = createLineupStore(deps);
    await store.getState().load("event-1");
    const next = deferred<Lineup>();
    deps.loadLineup.mockReturnValueOnce(next.promise);

    const loading = store.getState().load("event-2");

    expect(store.getState()).toMatchObject({ eventId: "event-2", concerts: [], event: null, loadStatus: "loading" });
    next.resolve(lineup());
    await loading;
    expect(selectHasLineup(store.getState())).toBe(false);
  });

  it("ignores an older response that settles after a newer one", async () => {
    const first = deferred<Lineup>();
    const second = deferred<Lineup>();
    deps.loadLineup.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createLineupStore(deps);

    const older = store.getState().load("event-1");
    const newer = store.getState().load("event-1");
    second.resolve(lineup("new"));
    await expect(newer).resolves.toBe(true);
    first.resolve(lineup("old"));
    await expect(older).resolves.toBe(false);

    expect(store.getState().concerts.map((c) => c.id)).toEqual(["new"]);
  });

  it("ignores an older failure that settles after a newer success", async () => {
    const first = deferred<Lineup>();
    deps.loadLineup.mockReturnValueOnce(first.promise).mockResolvedValueOnce(lineup("c1"));
    const store = createLineupStore(deps);

    const older = store.getState().load("event-1");
    await store.getState().load("event-1");
    first.reject(new Error("late"));
    await expect(older).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ loadStatus: "ready", lastError: null });
  });

  it("reset() returns to the initial state and drops a late response", async () => {
    const pending = deferred<Lineup>();
    deps.loadLineup.mockReturnValueOnce(pending.promise);
    const store = createLineupStore(deps);

    const loading = store.getState().load("event-1");
    store.getState().reset();
    pending.resolve(lineup("c1"));
    await expect(loading).resolves.toBe(false);

    expect(store.getState()).toMatchObject({ eventId: null, event: null, concerts: [], loadStatus: "idle", lastError: null });
  });
});
