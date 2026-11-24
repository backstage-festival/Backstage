import type { Concert } from "@/domain/entities/Event";
import type { ScheduleItem } from "@/domain/entities/Schedule";
import { DomainError } from "@/domain/errors/DomainError";
import { ScheduleConflictError } from "@/domain/errors/ScheduleConflictError";
import type {
  AddToScheduleInput,
  AddToScheduleResult,
} from "@/use-cases/AddToScheduleUseCase";

import {
  createScheduleStore,
  selectIsPlanned,
  type ScheduleStoreDeps,
} from "../scheduleStore";
import { deferred } from "../testing/deferred";

const NOW = "2027-07-10T18:00:00.000Z";

const item = (concertId: string, addedAt = NOW): ScheduleItem => ({
  userId: "user-1",
  concertId,
  addedAt,
});

const concert: Concert = {
  id: "c-other",
  eventId: "event-1",
  stageId: "s1",
  artist: "Mewy Nocą",
  startsAt: "2027-07-10T20:00:00Z",
  endsAt: "2027-07-10T21:00:00Z",
};

describe("scheduleStore", () => {
  const makeDeps = () => ({
    addToSchedule: {
      execute: jest.fn<Promise<AddToScheduleResult>, [AddToScheduleInput]>(),
    },
    loadSchedule: jest.fn<Promise<readonly ScheduleItem[]>, [string]>(),
    removeFromSchedule: jest.fn<Promise<void>, [string, string]>(),
  });
  let deps: ReturnType<typeof makeDeps>;

  const setup = async (planned: readonly ScheduleItem[] = []) => {
    deps.loadSchedule.mockResolvedValueOnce(planned);
    const store = createScheduleStore(deps satisfies ScheduleStoreDeps);
    await store.getState().load("user-1", "event-1");
    return store;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    deps = makeDeps();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("load", () => {
    it("loads the plan of the user", async () => {
      const store = await setup([item("c1")]);

      expect(deps.loadSchedule).toHaveBeenCalledWith("user-1");
      expect(store.getState()).toMatchObject({
        userId: "user-1",
        eventId: "event-1",
        loadStatus: "ready",
      });
      expect(selectIsPlanned("c1")(store.getState())).toBe(true);
    });

    it("sets loadStatus error when loading fails", async () => {
      deps.loadSchedule.mockRejectedValueOnce(new Error("db"));
      const store = createScheduleStore(deps);

      await expect(store.getState().load("user-1", "event-1")).resolves.toBe(
        false,
      );
      expect(store.getState().loadStatus).toBe("error");
      expect(store.getState().lastError).toEqual({ kind: "loadFailed" });
    });

    it("keeps an optimistic add that is still pending when a reload finishes", async () => {
      const store = await setup();
      const pending = deferred<AddToScheduleResult>();
      deps.addToSchedule.execute.mockReturnValueOnce(pending.promise);

      const adding = store.getState().add("c1");
      deps.loadSchedule.mockResolvedValueOnce([item("c2")]);
      await store.getState().load("user-1", "event-1");

      expect([...store.getState().plannedIds].sort()).toEqual(["c1", "c2"]);
      pending.resolve({ status: "added", item: item("c1"), conflicts: [] });
      await adding;
    });
  });

  describe("add", () => {
    it("marks the concert as planned before the use case resolves", async () => {
      const store = await setup();
      const pending = deferred<AddToScheduleResult>();
      deps.addToSchedule.execute.mockReturnValueOnce(pending.promise);

      const adding = store.getState().add("c1");

      expect(selectIsPlanned("c1")(store.getState())).toBe(true);
      expect(store.getState().pendingIds.has("c1")).toBe(true);
      expect(store.getState().items).toEqual([item("c1")]);

      pending.resolve({
        status: "added",
        item: item("c1", "2027-07-10T18:00:01.000Z"),
        conflicts: [],
      });
      await expect(adding).resolves.toBe(true);
    });

    it("replaces the optimistic item with the saved one on success", async () => {
      const store = await setup();
      const saved = item("c1", "2027-07-10T18:00:01.000Z");
      deps.addToSchedule.execute.mockResolvedValueOnce({
        status: "added",
        item: saved,
        conflicts: [],
      });

      await expect(store.getState().add("c1")).resolves.toBe(true);

      expect(deps.addToSchedule.execute).toHaveBeenCalledWith({
        userId: "user-1",
        eventId: "event-1",
        concertId: "c1",
        allowConflict: undefined,
      });
      expect(store.getState().items).toEqual([saved]);
      expect(store.getState().pendingIds.size).toBe(0);
      expect(store.getState().lastError).toBeNull();
    });

    it("keeps the concert planned when the use case says already_planned", async () => {
      const store = await setup();
      deps.addToSchedule.execute.mockResolvedValueOnce({
        status: "already_planned",
      });

      await expect(store.getState().add("c1")).resolves.toBe(true);

      expect(selectIsPlanned("c1")(store.getState())).toBe(true);
      expect(store.getState().pendingIds.size).toBe(0);
    });

    it("rolls back and exposes the conflicts on ScheduleConflictError", async () => {
      const store = await setup();
      deps.addToSchedule.execute.mockRejectedValueOnce(
        new ScheduleConflictError([concert]),
      );

      await expect(store.getState().add("c1")).resolves.toBe(false);

      expect(selectIsPlanned("c1")(store.getState())).toBe(false);
      expect(store.getState().items).toEqual([]);
      expect(store.getState().pendingIds.size).toBe(0);
      expect(store.getState().lastError).toEqual({
        kind: "conflict",
        concertId: "c1",
        conflicts: [concert],
      });
    });

    it("passes allowConflict when the user confirms the conflict", async () => {
      const store = await setup();
      deps.addToSchedule.execute.mockResolvedValueOnce({
        status: "added",
        item: item("c1"),
        conflicts: [concert],
      });

      await store.getState().add("c1", { allowConflict: true });

      expect(deps.addToSchedule.execute).toHaveBeenCalledWith(
        expect.objectContaining({ allowConflict: true }),
      );
      expect(selectIsPlanned("c1")(store.getState())).toBe(true);
    });

    it.each([
      [
        new DomainError("CONCERT_NOT_FOUND", "x"),
        { kind: "concertNotFound", concertId: "c1" },
      ],
      [new Error("disk full"), { kind: "saveFailed", concertId: "c1" }],
    ])("rolls back and maps %p", async (error, expected) => {
      const store = await setup();
      deps.addToSchedule.execute.mockRejectedValueOnce(error);

      await expect(store.getState().add("c1")).resolves.toBe(false);

      expect(selectIsPlanned("c1")(store.getState())).toBe(false);
      expect(store.getState().lastError).toEqual(expected);
    });

    it("ignores a second add of the same concert while saving", async () => {
      const store = await setup();
      const pending = deferred<AddToScheduleResult>();
      deps.addToSchedule.execute.mockReturnValueOnce(pending.promise);

      const first = store.getState().add("c1");
      await expect(store.getState().add("c1")).resolves.toBe(false);

      expect(deps.addToSchedule.execute).toHaveBeenCalledTimes(1);
      expect(store.getState().items).toHaveLength(1);
      pending.resolve({ status: "added", item: item("c1"), conflicts: [] });
      await first;
    });

    it("rolls back only the failed one of two parallel adds", async () => {
      const store = await setup();
      const first = deferred<AddToScheduleResult>();
      const second = deferred<AddToScheduleResult>();
      deps.addToSchedule.execute
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const addingFirst = store.getState().add("c1");
      const addingSecond = store.getState().add("c2");

      // The earlier action fails after the later one was applied.
      first.reject(new Error("offline"));
      await addingFirst;
      second.resolve({ status: "added", item: item("c2"), conflicts: [] });
      await addingSecond;

      expect([...store.getState().plannedIds]).toEqual(["c2"]);
      expect(store.getState().items).toEqual([item("c2")]);
      expect(store.getState().lastError).toEqual({
        kind: "saveFailed",
        concertId: "c1",
      });
    });

    it("refuses to add before the plan is loaded", async () => {
      const store = createScheduleStore(deps);

      await expect(store.getState().add("c1")).resolves.toBe(false);

      expect(deps.addToSchedule.execute).not.toHaveBeenCalled();
      expect(store.getState().lastError).toEqual({ kind: "notLoaded" });
    });
  });

  describe("remove", () => {
    it("removes the concert before the promise resolves", async () => {
      const store = await setup([item("c1"), item("c2")]);
      const pending = deferred<void>();
      deps.removeFromSchedule.mockReturnValueOnce(pending.promise);

      const removing = store.getState().remove("c1");

      expect(selectIsPlanned("c1")(store.getState())).toBe(false);
      expect(store.getState().pendingIds.has("c1")).toBe(true);

      pending.resolve();
      await expect(removing).resolves.toBe(true);
      expect(deps.removeFromSchedule).toHaveBeenCalledWith("user-1", "c1");
      expect(store.getState().items).toEqual([item("c2")]);
      expect(store.getState().pendingIds.size).toBe(0);
    });

    it("restores the item at its position when removing fails", async () => {
      const store = await setup([item("c1"), item("c2"), item("c3")]);
      deps.removeFromSchedule.mockRejectedValueOnce(new Error("db"));

      await expect(store.getState().remove("c2")).resolves.toBe(false);

      expect(store.getState().items.map((i) => i.concertId)).toEqual([
        "c1",
        "c2",
        "c3",
      ]);
      expect(selectIsPlanned("c2")(store.getState())).toBe(true);
      expect(store.getState().lastError).toEqual({
        kind: "removeFailed",
        concertId: "c2",
      });
    });

    it("ignores a second remove of the same concert while saving", async () => {
      const store = await setup([item("c1")]);
      const pending = deferred<void>();
      deps.removeFromSchedule.mockReturnValueOnce(pending.promise);

      const first = store.getState().remove("c1");
      await expect(store.getState().remove("c1")).resolves.toBe(false);

      expect(deps.removeFromSchedule).toHaveBeenCalledTimes(1);
      pending.resolve();
      await first;
    });

    it("rolls back only the failed one of two parallel removes", async () => {
      const store = await setup([item("c1"), item("c2")]);
      const first = deferred<void>();
      const second = deferred<void>();
      deps.removeFromSchedule
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const removingFirst = store.getState().remove("c1");
      const removingSecond = store.getState().remove("c2");
      second.resolve();
      await removingSecond;
      first.reject(new Error("db"));
      await removingFirst;

      expect(store.getState().items).toEqual([item("c1")]);
      expect([...store.getState().plannedIds]).toEqual(["c1"]);
    });
  });

  describe("writes that settle while load() is in flight", () => {
    const startLoad = (store: ReturnType<typeof createScheduleStore>) => {
      const pending = deferred<readonly ScheduleItem[]>();
      deps.loadSchedule.mockReturnValueOnce(pending.promise);
      const loading = store.getState().load("user-1", "event-1");
      return { pending, loading };
    };

    it("keeps an add that was saved before the stale list arrives", async () => {
      const store = await setup();
      const { pending, loading } = startLoad(store);
      deps.addToSchedule.execute.mockResolvedValueOnce({
        status: "added",
        item: item("c1"),
        conflicts: [],
      });

      await expect(store.getState().add("c1")).resolves.toBe(true);
      pending.resolve([item("c2")]);
      await loading;

      expect([...store.getState().plannedIds].sort()).toEqual(["c1", "c2"]);
      expect(store.getState().items.map((i) => i.concertId).sort()).toEqual([
        "c1",
        "c2",
      ]);
    });

    it("does not bring back a concert removed before the stale list arrives", async () => {
      const store = await setup([item("c1"), item("c2")]);
      const { pending, loading } = startLoad(store);
      deps.removeFromSchedule.mockResolvedValueOnce(undefined);

      await expect(store.getState().remove("c1")).resolves.toBe(true);
      pending.resolve([item("c1"), item("c2")]);
      await loading;

      expect([...store.getState().plannedIds]).toEqual(["c2"]);
      expect(store.getState().items).toEqual([item("c2")]);
    });

    it("keeps a rolled-back add out of the plan", async () => {
      const store = await setup();
      const { pending, loading } = startLoad(store);
      deps.addToSchedule.execute.mockRejectedValueOnce(new Error("offline"));

      await expect(store.getState().add("c1")).resolves.toBe(false);
      pending.resolve([]);
      await loading;

      expect(selectIsPlanned("c1")(store.getState())).toBe(false);
      expect(store.getState().items).toEqual([]);
    });

    it("keeps a rolled-back remove exactly once", async () => {
      const store = await setup([item("c1")]);
      const { pending, loading } = startLoad(store);
      deps.removeFromSchedule.mockRejectedValueOnce(new Error("db"));

      await expect(store.getState().remove("c1")).resolves.toBe(false);
      pending.resolve([item("c1")]);
      await loading;

      expect(store.getState().items).toEqual([item("c1")]);
      expect(selectIsPlanned("c1")(store.getState())).toBe(true);
    });

    it("lets the next load() take over once it starts after the write", async () => {
      const store = await setup();
      deps.addToSchedule.execute.mockResolvedValueOnce({
        status: "added",
        item: item("c1"),
        conflicts: [],
      });
      await store.getState().add("c1");

      // c1 was removed elsewhere; a load started after the write wins.
      deps.loadSchedule.mockResolvedValueOnce([]);
      await store.getState().load("user-1", "event-1");

      expect(selectIsPlanned("c1")(store.getState())).toBe(false);
    });
  });

  describe("reset", () => {
    it("restores the initial state", async () => {
      const store = await setup([item("c1")]);

      store.getState().reset();

      expect(store.getState()).toMatchObject({
        userId: null,
        eventId: null,
        items: [],
        loadStatus: "idle",
        lastError: null,
      });
      expect(store.getState().plannedIds.size).toBe(0);
      expect(store.getState().pendingIds.size).toBe(0);
    });

    it("drops a load() that resolves after reset", async () => {
      const store = createScheduleStore(deps);
      const pending = deferred<readonly ScheduleItem[]>();
      deps.loadSchedule.mockReturnValueOnce(pending.promise);

      const loading = store.getState().load("user-1", "event-1");
      store.getState().reset();
      pending.resolve([item("c1")]);

      await expect(loading).resolves.toBe(false);
      expect(store.getState().items).toEqual([]);
      expect(store.getState().loadStatus).toBe("idle");
    });

    it("drops the rollback of an add that fails after reset", async () => {
      const store = await setup();
      const pending = deferred<AddToScheduleResult>();
      deps.addToSchedule.execute.mockReturnValueOnce(pending.promise);

      const adding = store.getState().add("c1");
      store.getState().reset();
      pending.reject(new Error("offline"));

      await expect(adding).resolves.toBe(false);
      expect(store.getState().lastError).toBeNull();
      expect(store.getState().items).toEqual([]);
    });
  });

  it("clearError resets lastError", async () => {
    const store = await setup();
    deps.addToSchedule.execute.mockRejectedValueOnce(new Error("x"));
    await store.getState().add("c1");

    store.getState().clearError();

    expect(store.getState().lastError).toBeNull();
  });
});
