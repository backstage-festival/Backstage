import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { CheckIn, ScheduleItem } from "@/domain/entities/Schedule";
import type { User } from "@/domain/entities/User";
import type { SyncOutboxResult } from "@/use-cases/SyncOutboxUseCase";

import { createAuthStore } from "../authStore";
import { createCheckInStore } from "../checkInStore";
import { createMessageStore } from "../messageStore";
import { resetOnLogout } from "../resetOnLogout";
import { createScheduleStore } from "../scheduleStore";

const NOW = "2027-07-10T18:00:00.000Z";

const user = (id: string): User => ({
  id,
  login: id,
  passwordHash: "hash",
  createdAt: NOW,
});

const planned: ScheduleItem = { userId: "u-1", concertId: "c1", addedAt: NOW };
const checkedIn: CheckIn = {
  id: "ci-1",
  userId: "u-1",
  concertId: "c1",
  createdAt: NOW,
};
const queued: OutboxMessage = {
  id: "m1",
  crewId: "crew-1",
  authorId: "u-1",
  body: "Hej",
  status: "queued",
  attempts: 0,
  createdAt: NOW,
  nextAttemptAt: null,
  sentAt: null,
};

describe("resetOnLogout", () => {
  const setup = async () => {
    const login = jest.fn<Promise<User>, [string, string]>();
    const authStore = createAuthStore({ login, register: jest.fn() });
    const scheduleStore = createScheduleStore({
      addToSchedule: { execute: jest.fn() },
      loadSchedule: jest
        .fn<Promise<readonly ScheduleItem[]>, [string]>()
        .mockResolvedValue([planned]),
      removeFromSchedule: jest.fn(),
    });
    const messageStore = createMessageStore({
      queueMessage: { execute: jest.fn() },
      retryMessage: { execute: jest.fn() },
      syncOutbox: {
        execute: jest
          .fn<Promise<SyncOutboxResult>, []>()
          .mockResolvedValue({ offline: true, sentIds: [], failedId: null }),
      },
      loadMessages: jest
        .fn<Promise<readonly OutboxMessage[]>, [string]>()
        .mockResolvedValue([queued]),
    });
    const checkInStore = createCheckInStore({
      checkIn: { execute: jest.fn() },
      loadCheckIns: jest
        .fn<Promise<readonly CheckIn[]>, [string]>()
        .mockResolvedValue([checkedIn]),
    });

    const unsubscribe = resetOnLogout(authStore, [
      scheduleStore,
      messageStore,
      checkInStore,
    ]);

    login.mockResolvedValueOnce(user("u-1"));
    await authStore.getState().login("u-1", "secret");
    await scheduleStore.getState().load("u-1", "event-1");
    await messageStore.getState().load("crew-1");
    await checkInStore.getState().load("u-1");

    return {
      login,
      authStore,
      scheduleStore,
      messageStore,
      checkInStore,
      unsubscribe,
    };
  };

  it("logout clears the plan, the messages and the check-ins", async () => {
    const { authStore, scheduleStore, messageStore, checkInStore } =
      await setup();
    expect(scheduleStore.getState().items).toHaveLength(1);
    expect(messageStore.getState().messages).toHaveLength(1);
    expect(checkInStore.getState().checkedInConcertIds.size).toBe(1);

    authStore.getState().logout();

    expect(scheduleStore.getState()).toMatchObject({
      userId: null,
      items: [],
      loadStatus: "idle",
    });
    expect(messageStore.getState()).toMatchObject({
      crewId: null,
      messages: [],
      loadStatus: "idle",
    });
    expect(checkInStore.getState().checkedInConcertIds.size).toBe(0);
  });

  it("does not reset on a failed login or other auth changes", async () => {
    const { login, authStore, scheduleStore } = await setup();
    login.mockRejectedValueOnce(new Error("x"));

    await authStore.getState().login("u-1", "secret");
    authStore.getState().clearError();

    expect(scheduleStore.getState().items).toHaveLength(1);
  });

  it("stops resetting after unsubscribe", async () => {
    const { authStore, scheduleStore, unsubscribe } = await setup();

    unsubscribe();
    authStore.getState().logout();

    expect(scheduleStore.getState().items).toHaveLength(1);
  });
});
