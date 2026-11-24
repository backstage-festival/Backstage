import { mockCurrentUserId, mockEvent } from "@/mocks/mockData";
import {
  failNextWrite,
  MOCK_DELAY_MS,
  mockMessageDeps,
  mockScheduleDeps,
} from "@/mocks/mockStoreDeps";

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
