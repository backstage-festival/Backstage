import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { CheckIn, ScheduleItem } from "@/domain/entities/Schedule";
import type { User } from "@/domain/entities/User";
import type { SyncOutboxResult } from "@/use-cases/SyncOutboxUseCase";

import { createAuthStore } from "../authStore";
import { createCheckInStore } from "../checkInStore";
import { createMessageStore } from "../messageStore";
import { resetOnLogout } from "../resetOnLogout";
import { createScheduleStore } from "../scheduleStore";
import { type AccessibilitySettings, createSettingsStore, DEFAULT_SETTINGS } from "../settingsStore";

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

    const settingsStore = createSettingsStore({
      loadSettings: jest
        .fn<Promise<AccessibilitySettings | null>, [string]>()
        .mockResolvedValue({ ...DEFAULT_SETTINGS, highContrast: true }),
      saveSetting: jest.fn(),
    });

    const unsubscribe = resetOnLogout(authStore, [
      scheduleStore,
      messageStore,
      checkInStore,
      settingsStore,
    ]);

    login.mockResolvedValueOnce(user("u-1"));
    await authStore.getState().login("u-1", "secret");
    await scheduleStore.getState().load("u-1", "event-1");
    await messageStore.getState().load("crew-1");
    await checkInStore.getState().load("u-1");
    await settingsStore.getState().load("u-1");

    return {
      settingsStore,
      login,
      authStore,
      scheduleStore,
      messageStore,
      checkInStore,
      unsubscribe,
    };
  };

  it("logout clears the plan, the messages, the check-ins and the settings", async () => {
    const { authStore, scheduleStore, messageStore, checkInStore, settingsStore } =
      await setup();
    expect(settingsStore.getState().highContrast).toBe(true);
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
    expect(settingsStore.getState()).toMatchObject({ userId: null, highContrast: false });
  });

  it("does not reset on a failed login or other auth changes", async () => {
    const { login, authStore, scheduleStore } = await setup();
    login.mockRejectedValueOnce(new Error("x"));

    await authStore.getState().login("u-1", "secret");
    authStore.getState().clearError();

    expect(scheduleStore.getState().items).toHaveLength(1);
  });

  it("resets when another user signs in without logging out (A → B)", async () => {
    const { login, authStore, scheduleStore, messageStore, checkInStore } =
      await setup();
    login.mockResolvedValueOnce(user("u-2"));

    await authStore.getState().login("u-2", "secret");

    expect(authStore.getState().user?.id).toBe("u-2");
    expect(scheduleStore.getState().items).toEqual([]);
    expect(messageStore.getState().messages).toEqual([]);
    expect(checkInStore.getState().checkedInConcertIds.size).toBe(0);
  });

  it("does not reset when the same user signs in again (A → A)", async () => {
    const { login, authStore, scheduleStore } = await setup();
    login.mockResolvedValueOnce(user("u-1"));

    await authStore.getState().login("u-1", "secret");

    expect(scheduleStore.getState().items).toHaveLength(1);
  });

  it("does not reset on the first sign-in (null → A)", async () => {
    const { login, authStore, scheduleStore } = await setup();
    authStore.getState().logout();
    await scheduleStore.getState().load("u-1", "event-1");
    login.mockResolvedValueOnce(user("u-1"));

    await authStore.getState().login("u-1", "secret");

    expect(scheduleStore.getState().items).toHaveLength(1);
  });

  it("stops resetting after unsubscribe", async () => {
    const { authStore, scheduleStore, unsubscribe } = await setup();

    unsubscribe();
    authStore.getState().logout();

    expect(scheduleStore.getState().items).toHaveLength(1);
  });
});
