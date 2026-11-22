import type { CheckIn } from "@/domain/entities/Schedule";
import { DomainError } from "@/domain/errors/DomainError";
import { TooFarFromStageError } from "@/domain/errors/TooFarFromStageError";
import type { CheckInInput, CheckInResult } from "@/use-cases/CheckInUseCase";

import {
  type CheckInStoreDeps,
  createCheckInStore,
  selectIsCheckedIn,
} from "../checkInStore";
import { deferred } from "../testing/deferred";

const NOW = "2027-07-10T18:00:00.000Z";

const checkIn = (concertId: string): CheckIn => ({
  id: `ci-${concertId}`,
  userId: "user-1",
  concertId,
  createdAt: NOW,
});

const checkedIn = (concertId: string): CheckInResult => ({
  status: "checked_in",
  checkIn: checkIn(concertId),
  distanceMeters: 12,
});

describe("checkInStore", () => {
  const makeDeps = () => ({
    checkIn: { execute: jest.fn<Promise<CheckInResult>, [CheckInInput]>() },
    loadCheckIns: jest.fn<Promise<readonly CheckIn[]>, [string]>(),
  });
  let deps: ReturnType<typeof makeDeps>;

  const create = () => createCheckInStore(deps satisfies CheckInStoreDeps);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    deps = makeDeps();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads the check-ins of the user", async () => {
    deps.loadCheckIns.mockResolvedValueOnce([checkIn("c1")]);
    const store = create();

    await expect(store.getState().load("user-1")).resolves.toBe(true);

    expect(deps.loadCheckIns).toHaveBeenCalledWith("user-1");
    expect(selectIsCheckedIn("c1")(store.getState())).toBe(true);
    expect(store.getState().loadStatus).toBe("ready");
  });

  it("sets loadStatus error when loading fails", async () => {
    deps.loadCheckIns.mockRejectedValueOnce(new Error("db"));
    const store = create();

    await expect(store.getState().load("user-1")).resolves.toBe(false);

    expect(store.getState().lastError).toEqual({ kind: "loadFailed" });
  });

  it("marks the concert before the use case resolves", async () => {
    const store = create();
    const pending = deferred<CheckInResult>();
    deps.checkIn.execute.mockReturnValueOnce(pending.promise);

    const checking = store.getState().checkIn("user-1", "event-1", "c1");

    expect(selectIsCheckedIn("c1")(store.getState())).toBe(true);
    expect(store.getState().pendingIds.has("c1")).toBe(true);

    pending.resolve(checkedIn("c1"));
    await expect(checking).resolves.toBe(true);
    expect(deps.checkIn.execute).toHaveBeenCalledWith({
      userId: "user-1",
      eventId: "event-1",
      concertId: "c1",
    });
    expect(store.getState().pendingIds.size).toBe(0);
  });

  it("keeps the mark when the use case says already_checked_in", async () => {
    const store = create();
    deps.checkIn.execute.mockResolvedValueOnce({
      status: "already_checked_in",
    });

    await expect(
      store.getState().checkIn("user-1", "event-1", "c1"),
    ).resolves.toBe(true);

    expect(selectIsCheckedIn("c1")(store.getState())).toBe(true);
  });

  it.each([
    [
      new TooFarFromStageError(340),
      { kind: "tooFar", concertId: "c1", distanceMeters: 340 },
    ],
    [
      new DomainError("CHECK_IN_CLOSED", "x"),
      { kind: "closed", concertId: "c1" },
    ],
    [
      new DomainError("LOCATION_UNAVAILABLE", "x"),
      { kind: "locationUnavailable", concertId: "c1" },
    ],
    [
      new DomainError("STAGE_NOT_FOUND", "x"),
      { kind: "saveFailed", concertId: "c1" },
    ],
    [new Error("db"), { kind: "saveFailed", concertId: "c1" }],
  ])("rolls back and maps %p", async (error, expected) => {
    const store = create();
    deps.checkIn.execute.mockRejectedValueOnce(error);

    await expect(
      store.getState().checkIn("user-1", "event-1", "c1"),
    ).resolves.toBe(false);

    expect(selectIsCheckedIn("c1")(store.getState())).toBe(false);
    expect(store.getState().pendingIds.size).toBe(0);
    expect(store.getState().lastError).toEqual(expected);
  });

  it("ignores a second check-in on the same concert while saving", async () => {
    const store = create();
    const pending = deferred<CheckInResult>();
    deps.checkIn.execute.mockReturnValueOnce(pending.promise);

    const first = store.getState().checkIn("user-1", "event-1", "c1");
    await expect(
      store.getState().checkIn("user-1", "event-1", "c1"),
    ).resolves.toBe(false);

    expect(deps.checkIn.execute).toHaveBeenCalledTimes(1);
    pending.resolve(checkedIn("c1"));
    await first;
  });

  it("rolls back only the failed one of two parallel check-ins", async () => {
    const store = create();
    const first = deferred<CheckInResult>();
    const second = deferred<CheckInResult>();
    deps.checkIn.execute
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const checkingFirst = store.getState().checkIn("user-1", "event-1", "c1");
    const checkingSecond = store.getState().checkIn("user-1", "event-1", "c2");
    second.resolve(checkedIn("c2"));
    await checkingSecond;
    first.reject(new TooFarFromStageError(500));
    await checkingFirst;

    expect([...store.getState().checkedInConcertIds]).toEqual(["c2"]);
  });

  describe("writes that settle while load() is in flight", () => {
    const startLoad = (store: ReturnType<typeof createCheckInStore>) => {
      const pending = deferred<readonly CheckIn[]>();
      deps.loadCheckIns.mockReturnValueOnce(pending.promise);
      const loading = store.getState().load("user-1");
      return { pending, loading };
    };

    it("keeps a check-in saved before the stale list arrives", async () => {
      const store = create();
      const { pending, loading } = startLoad(store);
      deps.checkIn.execute.mockResolvedValueOnce(checkedIn("c1"));

      await expect(
        store.getState().checkIn("user-1", "event-1", "c1"),
      ).resolves.toBe(true);
      pending.resolve([checkIn("c2")]);
      await loading;

      expect([...store.getState().checkedInConcertIds].sort()).toEqual([
        "c1",
        "c2",
      ]);
    });

    it("keeps a rolled-back check-in unmarked", async () => {
      const store = create();
      const { pending, loading } = startLoad(store);
      deps.checkIn.execute.mockRejectedValueOnce(new TooFarFromStageError(300));

      await expect(
        store.getState().checkIn("user-1", "event-1", "c1"),
      ).resolves.toBe(false);
      pending.resolve([checkIn("c2")]);
      await loading;

      expect([...store.getState().checkedInConcertIds]).toEqual(["c2"]);
    });
  });

  it("reset clears check-ins and drops a load() that resolves later", async () => {
    deps.loadCheckIns.mockResolvedValueOnce([checkIn("c1")]);
    const store = create();
    await store.getState().load("user-1");
    const pending = deferred<readonly CheckIn[]>();
    deps.loadCheckIns.mockReturnValueOnce(pending.promise);

    const loading = store.getState().load("user-1");
    store.getState().reset();
    pending.resolve([checkIn("c2")]);

    await expect(loading).resolves.toBe(false);
    expect(store.getState().checkedInConcertIds.size).toBe(0);
    expect(store.getState().loadStatus).toBe("idle");
  });

  it("clearError resets lastError", async () => {
    const store = create();
    deps.checkIn.execute.mockRejectedValueOnce(new Error("db"));
    await store.getState().checkIn("user-1", "event-1", "c1");

    store.getState().clearError();

    expect(store.getState().lastError).toBeNull();
  });
});
