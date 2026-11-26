import type { Coordinates } from "@/domain/entities/common";
import { TooFarFromStageError } from "@/domain/errors/TooFarFromStageError";
import { mockCurrentUserId, mockEvent } from "@/mocks/mockData";
import {
  failNextWrite,
  MOCK_DELAY_MS,
  MOCK_NEAR_STAGE_M,
  mockCheckInDeps,
  mockLocationService,
  mockMessageDeps,
  mockScheduleDeps,
  setMockPosition,
} from "@/mocks/mockStoreDeps";

import { createCheckInStore, selectIsCheckedIn } from "../checkInStore";
import { createMessageStore } from "../messageStore";
import { createScheduleStore, selectIsPlanned } from "../scheduleStore";

/** Runs an action while advancing the mock delay timers. */
async function settle<T>(action: Promise<T>): Promise<T> {
  await jest.advanceTimersByTimeAsync(MOCK_DELAY_MS * 4);
  return action;
}

describe("mock store deps (demo wiring)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // After every mock message (latest 21:48), so a new message sorts last.
    jest.setSystemTime(new Date("2027-07-02T22:00:00+02:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("detects a real conflict and rolls back after failNextWrite()", async () => {
    const store = createScheduleStore(mockScheduleDeps);
    await settle(store.getState().load(mockCurrentUserId, mockEvent.id));
    expect(selectIsPlanned("c-wilga-i-fale")(store.getState())).toBe(true);

    // Sodium b2b Ostra overlaps Hanna Sieradz from the mock plan.
    await expect(
      settle(store.getState().add("c-sodium-b2b-ostra")),
    ).resolves.toBe(false);
    expect(store.getState().lastError).toMatchObject({ kind: "conflict" });

    failNextWrite();
    const adding = store.getState().add("c-biala-goraczka");
    expect(selectIsPlanned("c-biala-goraczka")(store.getState())).toBe(true);
    await expect(settle(adding)).resolves.toBe(false);
    expect(selectIsPlanned("c-biala-goraczka")(store.getState())).toBe(false);
  });

  it("queues a message through the real use case", async () => {
    const store = createMessageStore(mockMessageDeps);
    await settle(store.getState().load("crew-mewy"));
    const before = store.getState().messages.length;

    await expect(
      settle(store.getState().send("  Jestem pod S1  ", mockCurrentUserId)),
    ).resolves.toBe(true);

    // The use case normalizes the body and assigns the real id.
    const last = store.getState().messages.at(-1);
    expect(last?.body).toBe("Jestem pod S1");
    expect(last?.id.startsWith("local-")).toBe(false);
    expect(store.getState().messages.length).toBe(before + 1);
  });
});

/*
 * Check-in mock: S2 (Doki) is used on purpose – in mockData the gate is only
 * ~19 m from S1, so an S1 concert is in range even at the gate.
 */
describe("mock check-in geofence (TEMP until #32)", () => {
  const S2_CONCERT = "c-hanna-sieradz";
  const OTHER_S2_CONCERT = "c-bursztyn-trio";
  const input = (concertId: string) => ({ userId: "u-geofence", eventId: mockEvent.id, concertId });

  beforeEach(() => {
    jest.useFakeTimers();
    setMockPosition("gate");
  });

  afterEach(() => {
    setMockPosition("gate");
    jest.useRealTimers();
  });

  it("rejects a check-in at the gate with the distance to the stage", async () => {
    // Caught at once: the mock rejects before any timer, settle() would leave it unhandled.
    const error = await settle(mockCheckInDeps.checkIn.execute(input(S2_CONCERT)).catch((e: unknown) => e));
    expect(error).toBeInstanceOf(TooFarFromStageError);
    expect(error).toMatchObject({ distanceMeters: 263 });
  });

  it("accepts a check-in next to the concert's stage", async () => {
    setMockPosition({ stageId: "s2" });
    await expect(settle(mockCheckInDeps.checkIn.execute(input(S2_CONCERT)))).resolves.toMatchObject({
      status: "checked_in",
      distanceMeters: MOCK_NEAR_STAGE_M,
    });
  });

  it("rolls the store back when the write fails (failNextWrite)", async () => {
    setMockPosition({ stageId: "s2" });
    const store = createCheckInStore(mockCheckInDeps);
    failNextWrite();

    const checking = store.getState().checkIn("u-geofence", mockEvent.id, OTHER_S2_CONCERT);
    expect(selectIsCheckedIn(OTHER_S2_CONCERT)(store.getState())).toBe(true);
    await expect(settle(checking)).resolves.toBe(false);

    expect(store.getState().checkedInConcertIds.has(OTHER_S2_CONCERT)).toBe(false);
    expect(store.getState().lastError).toEqual({ kind: "saveFailed", concertId: OTHER_S2_CONCERT });
  });

  it("marks the concert checked in at once and unmarks it after a failed write", async () => {
    setMockPosition({ stageId: "s2" });
    const store = createCheckInStore(mockCheckInDeps);
    failNextWrite();

    const checking = store.getState().checkIn("u-optimistic", mockEvent.id, S2_CONCERT);
    // Before the write settles: Optimistic UI („Zameldowano” on the card).
    expect(selectIsCheckedIn(S2_CONCERT)(store.getState())).toBe(true);
    expect(store.getState().pendingIds.has(S2_CONCERT)).toBe(true);

    await expect(settle(checking)).resolves.toBe(false);
    expect(selectIsCheckedIn(S2_CONCERT)(store.getState())).toBe(false);
    expect(store.getState().pendingIds.has(S2_CONCERT)).toBe(false);
    expect(store.getState().lastError).toEqual({ kind: "saveFailed", concertId: S2_CONCERT });
  });

  it("emits a new position to watchers on setMockPosition", async () => {
    const seen: Coordinates[] = [];
    const stop = await mockLocationService.watchPosition((position) => seen.push(position));
    await jest.advanceTimersByTimeAsync(0);
    setMockPosition({ stageId: "s2" });
    stop();
    setMockPosition("gate");

    expect(seen).toHaveLength(2);
    expect(seen[1]?.latitude).toBeGreaterThan(seen[0]?.latitude ?? Infinity);
    await expect(mockLocationService.getCurrentPosition()).resolves.toEqual(seen[0]);
  });
});
