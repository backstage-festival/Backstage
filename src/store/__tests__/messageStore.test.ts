import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import { DomainError } from "@/domain/errors/DomainError";
import { MAX_AUTO_RETRY_ATTEMPTS } from "@/domain/utils/retryBackoff";
import type { QueueMessageInput } from "@/use-cases/QueueMessageUseCase";
import type { SyncOutboxResult } from "@/use-cases/SyncOutboxUseCase";

import {
  createMessageStore,
  type MessageStoreDeps,
  selectDeliveryState,
  selectQueuedCount,
} from "../messageStore";
import { deferred } from "../testing/deferred";

const NOW = "2027-07-10T18:00:00.000Z";

const message = (
  id: string,
  overrides: Partial<OutboxMessage> = {},
): OutboxMessage => ({
  id,
  crewId: "crew-1",
  authorId: "user-1",
  body: id,
  status: "queued",
  attempts: 0,
  createdAt: "2027-07-10T17:55:00.000Z",
  nextAttemptAt: null,
  sentAt: null,
  ...overrides,
});

const OFFLINE: SyncOutboxResult = { offline: true, sentIds: [], failedId: null };

describe("messageStore", () => {
  const makeDeps = () => ({
    queueMessage: {
      execute: jest.fn<Promise<OutboxMessage>, [QueueMessageInput]>(),
    },
    retryMessage: { execute: jest.fn<Promise<void>, [string]>() },
    syncOutbox: {
      execute: jest
        .fn<Promise<SyncOutboxResult>, []>()
        .mockResolvedValue(OFFLINE),
    },
    loadMessages: jest.fn<Promise<readonly OutboxMessage[]>, [string]>(),
  });
  let deps: ReturnType<typeof makeDeps>;

  const setup = async (messages: readonly OutboxMessage[] = []) => {
    deps.loadMessages.mockResolvedValueOnce(messages);
    const store = createMessageStore(deps satisfies MessageStoreDeps);
    await store.getState().load("crew-1");
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
    it("loads the crew messages sorted by createdAt", async () => {
      const older = message("m1", { createdAt: "2027-07-10T17:00:00.000Z" });
      const newer = message("m2", { createdAt: "2027-07-10T17:30:00.000Z" });

      const store = await setup([newer, older]);

      expect(deps.loadMessages).toHaveBeenCalledWith("crew-1");
      expect(store.getState().messages).toEqual([older, newer]);
      expect(store.getState().loadStatus).toBe("ready");
    });

    it("sets loadStatus error when loading fails", async () => {
      deps.loadMessages.mockRejectedValueOnce(new Error("db"));
      const store = createMessageStore(deps);

      await expect(store.getState().load("crew-1")).resolves.toBe(false);

      expect(store.getState().loadStatus).toBe("error");
      expect(store.getState().lastError).toEqual({ kind: "loadFailed" });
    });
  });

  describe("send", () => {
    it("shows a local message with the current time before the use case resolves", async () => {
      const store = await setup();
      const pending = deferred<OutboxMessage>();
      deps.queueMessage.execute.mockReturnValueOnce(pending.promise);

      const sending = store.getState().send("Gdzie jesteście?", "user-1");

      expect(store.getState().messages).toEqual([
        {
          id: "local-1",
          crewId: "crew-1",
          authorId: "user-1",
          body: "Gdzie jesteście?",
          status: "queued",
          attempts: 0,
          createdAt: NOW,
          nextAttemptAt: null,
          sentAt: null,
        },
      ]);
      expect(store.getState().pendingIds.has("local-1")).toBe(true);

      pending.resolve(message("m-real", { createdAt: NOW }));
      await expect(sending).resolves.toBe(true);
    });

    it("replaces the local message with the queued one and starts a sync", async () => {
      const store = await setup();
      const queued = message("m-real", { body: "Hej", createdAt: NOW });
      deps.queueMessage.execute.mockResolvedValueOnce(queued);

      await expect(store.getState().send(" Hej ", "user-1")).resolves.toBe(
        true,
      );

      expect(deps.queueMessage.execute).toHaveBeenCalledWith({
        crewId: "crew-1",
        authorId: "user-1",
        body: " Hej ",
      });
      expect(store.getState().messages).toEqual([queued]);
      expect(store.getState().pendingIds.size).toBe(0);
      expect(deps.syncOutbox.execute).toHaveBeenCalledTimes(1);
    });

    it.each([
      [new DomainError("INVALID_MESSAGE_BODY", "x"), { kind: "invalidBody" }],
      [new Error("db"), { kind: "sendFailed" }],
    ])("removes the local message and maps %p", async (error, expected) => {
      const store = await setup([message("m1")]);
      deps.queueMessage.execute.mockRejectedValueOnce(error);

      await expect(store.getState().send("", "user-1")).resolves.toBe(false);

      expect(store.getState().messages.map((m) => m.id)).toEqual(["m1"]);
      expect(store.getState().pendingIds.size).toBe(0);
      expect(store.getState().lastError).toEqual(expected);
      expect(deps.syncOutbox.execute).not.toHaveBeenCalled();
    });

    it("removes only the failed one of two parallel sends", async () => {
      const store = await setup();
      const first = deferred<OutboxMessage>();
      const second = deferred<OutboxMessage>();
      deps.queueMessage.execute
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const sendingFirst = store.getState().send("one", "user-1");
      const sendingSecond = store.getState().send("two", "user-1");
      expect(store.getState().messages.map((m) => m.id)).toEqual([
        "local-1",
        "local-2",
      ]);

      first.reject(new Error("db"));
      await sendingFirst;
      second.resolve(message("m-two", { body: "two" }));
      await sendingSecond;

      expect(store.getState().messages.map((m) => m.id)).toEqual(["m-two"]);
    });

    it("refuses to send before a crew is loaded", async () => {
      const store = createMessageStore(deps);

      await expect(store.getState().send("x", "user-1")).resolves.toBe(false);

      expect(store.getState().lastError).toEqual({ kind: "notLoaded" });
    });
  });

  describe("retry", () => {
    const failed = message("m1", {
      attempts: MAX_AUTO_RETRY_ATTEMPTS,
      nextAttemptAt: null,
    });

    it("resets the attempts before the use case resolves", async () => {
      const store = await setup([failed]);
      const pending = deferred<void>();
      deps.retryMessage.execute.mockReturnValueOnce(pending.promise);

      const retrying = store.getState().retry("m1");

      expect(store.getState().messages[0]).toMatchObject({
        attempts: 0,
        nextAttemptAt: null,
      });
      expect(store.getState().pendingIds.has("m1")).toBe(true);

      pending.resolve();
      await expect(retrying).resolves.toBe(true);
      expect(deps.retryMessage.execute).toHaveBeenCalledWith("m1");
      expect(store.getState().pendingIds.size).toBe(0);
      expect(deps.syncOutbox.execute).toHaveBeenCalledTimes(1);
    });

    it("restores attempts and nextAttemptAt when the retry fails", async () => {
      const waiting = message("m1", {
        attempts: 3,
        nextAttemptAt: "2027-07-10T18:01:00.000Z",
      });
      const store = await setup([waiting]);
      deps.retryMessage.execute.mockRejectedValueOnce(
        new DomainError("MESSAGE_NOT_FOUND", "x"),
      );

      await expect(store.getState().retry("m1")).resolves.toBe(false);

      expect(store.getState().messages).toEqual([waiting]);
      expect(store.getState().lastError).toEqual({
        kind: "messageNotFound",
        messageId: "m1",
      });
    });

    it("maps an unknown error to retryFailed", async () => {
      const store = await setup([failed]);
      deps.retryMessage.execute.mockRejectedValueOnce(new Error("db"));

      await store.getState().retry("m1");

      expect(store.getState().lastError).toEqual({
        kind: "retryFailed",
        messageId: "m1",
      });
    });

    it("ignores a second retry of the same message while saving", async () => {
      const store = await setup([failed]);
      const pending = deferred<void>();
      deps.retryMessage.execute.mockReturnValueOnce(pending.promise);

      const first = store.getState().retry("m1");
      await expect(store.getState().retry("m1")).resolves.toBe(false);

      expect(deps.retryMessage.execute).toHaveBeenCalledTimes(1);
      pending.resolve();
      await first;
    });

    it("rolls back only the failed one of two parallel retries", async () => {
      const a = message("a", { attempts: 8 });
      const b = message("b", { attempts: 8 });
      const store = await setup([a, b]);
      const first = deferred<void>();
      const second = deferred<void>();
      deps.retryMessage.execute
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const retryingA = store.getState().retry("a");
      const retryingB = store.getState().retry("b");
      first.reject(new Error("db"));
      await retryingA;
      second.resolve();
      await retryingB;

      expect(store.getState().messages.map((m) => m.attempts)).toEqual([8, 0]);
    });
  });

  describe("sync", () => {
    it("reloads the list after an online sync", async () => {
      const store = await setup([message("m1")]);
      const pending = deferred<SyncOutboxResult>();
      deps.syncOutbox.execute.mockReturnValueOnce(pending.promise);
      const sent = message("m1", { status: "sent", sentAt: NOW });
      deps.loadMessages.mockResolvedValueOnce([sent]);

      const syncing = store.getState().sync();
      expect(store.getState().syncing).toBe(true);

      pending.resolve({ offline: false, sentIds: ["m1"], failedId: null });
      await syncing;

      expect(store.getState().messages).toEqual([sent]);
      expect(store.getState().syncing).toBe(false);
    });

    it("changes nothing while offline", async () => {
      const store = await setup([message("m1")]);
      const before = store.getState().messages;

      await store.getState().sync();

      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
      expect(store.getState().messages).toBe(before);
      expect(store.getState().syncing).toBe(false);
    });

    it("sets lastError instead of throwing when the sync fails", async () => {
      const store = await setup();
      deps.syncOutbox.execute.mockRejectedValueOnce(new Error("boom"));

      await expect(store.getState().sync()).resolves.toBeUndefined();

      expect(store.getState().lastError).toEqual({ kind: "syncFailed" });
      expect(store.getState().syncing).toBe(false);
    });

    it("keeps a pending local message when the reload finishes first", async () => {
      const store = await setup();
      const queueing = deferred<OutboxMessage>();
      deps.queueMessage.execute.mockReturnValueOnce(queueing.promise);
      deps.syncOutbox.execute.mockResolvedValueOnce({
        offline: false,
        sentIds: [],
        failedId: null,
      });
      deps.loadMessages.mockResolvedValueOnce([message("m-other")]);

      const sending = store.getState().send("hi", "user-1");
      await store.getState().sync();

      expect(store.getState().messages.map((m) => m.id)).toEqual([
        "m-other",
        "local-1",
      ]);
      queueing.resolve(message("m-real", { createdAt: NOW }));
      await sending;
    });

    it("does not leave loadStatus loading when the reload after sync fails", async () => {
      const store = await setup();
      const loading = deferred<readonly OutboxMessage[]>();
      deps.loadMessages.mockReturnValueOnce(loading.promise);
      deps.syncOutbox.execute.mockResolvedValueOnce({
        offline: false,
        sentIds: [],
        failedId: null,
      });
      deps.loadMessages.mockRejectedValueOnce(new Error("db"));

      const loadingCall = store.getState().load("crew-1");
      // sync() supersedes the load token, then its own reload throws.
      await store.getState().sync();
      loading.resolve([message("m1")]);
      await loadingCall;

      expect(store.getState().loadStatus).toBe("error");
      expect(store.getState().lastError).toEqual({ kind: "syncFailed" });
      expect(store.getState().syncing).toBe(false);
    });

    it("shares one in-flight sync between callers", async () => {
      const store = await setup();
      const pending = deferred<SyncOutboxResult>();
      deps.syncOutbox.execute.mockReturnValueOnce(pending.promise);

      const first = store.getState().sync();
      const second = store.getState().sync();
      pending.resolve(OFFLINE);
      await Promise.all([first, second]);

      expect(deps.syncOutbox.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("writes that settle while load() is in flight", () => {
    const startLoad = (store: ReturnType<typeof createMessageStore>) => {
      const pending = deferred<readonly OutboxMessage[]>();
      deps.loadMessages.mockReturnValueOnce(pending.promise);
      const loading = store.getState().load("crew-1");
      return { pending, loading };
    };

    it("keeps a message sent offline before the stale list arrives", async () => {
      const store = await setup();
      const { pending, loading } = startLoad(store);
      const queued = message("m-real", { body: "Hej", createdAt: NOW });
      deps.queueMessage.execute.mockResolvedValueOnce(queued);

      await expect(store.getState().send("Hej", "user-1")).resolves.toBe(true);
      // The sync started by send() reports offline, so there is no reload.
      await store.getState().sync();
      expect(deps.syncOutbox.execute).toHaveBeenCalled();
      pending.resolve([]);
      await loading;

      expect(store.getState().messages).toEqual([queued]);
    });

    it("does not leave a rolled-back send behind", async () => {
      const store = await setup();
      const { pending, loading } = startLoad(store);
      deps.queueMessage.execute.mockRejectedValueOnce(new Error("db"));

      await expect(store.getState().send("Hej", "user-1")).resolves.toBe(
        false,
      );
      pending.resolve([message("m-other")]);
      await loading;

      expect(store.getState().messages.map((m) => m.id)).toEqual(["m-other"]);
    });

    it("keeps a retry saved before the stale list arrives", async () => {
      const failed = message("m1", { attempts: MAX_AUTO_RETRY_ATTEMPTS });
      const store = await setup([failed]);
      const { pending, loading } = startLoad(store);
      deps.retryMessage.execute.mockResolvedValueOnce(undefined);

      await expect(store.getState().retry("m1")).resolves.toBe(true);
      pending.resolve([failed]);
      await loading;

      expect(store.getState().messages).toEqual([
        { ...failed, attempts: 0, nextAttemptAt: null },
      ]);
    });

    it("keeps a rolled-back retry exactly once", async () => {
      const failed = message("m1", { attempts: MAX_AUTO_RETRY_ATTEMPTS });
      const store = await setup([failed]);
      const { pending, loading } = startLoad(store);
      deps.retryMessage.execute.mockRejectedValueOnce(new Error("db"));

      await expect(store.getState().retry("m1")).resolves.toBe(false);
      pending.resolve([failed]);
      await loading;

      expect(store.getState().messages).toEqual([failed]);
    });
  });

  describe("reset", () => {
    it("restores the initial state", async () => {
      const store = await setup([message("m1")]);

      store.getState().reset();

      expect(store.getState()).toMatchObject({
        crewId: null,
        messages: [],
        loadStatus: "idle",
        syncing: false,
        lastError: null,
      });
    });

    it("drops a load() that resolves after reset", async () => {
      const store = createMessageStore(deps);
      const pending = deferred<readonly OutboxMessage[]>();
      deps.loadMessages.mockReturnValueOnce(pending.promise);

      const loading = store.getState().load("crew-1");
      store.getState().reset();
      pending.resolve([message("m1")]);

      await expect(loading).resolves.toBe(false);
      expect(store.getState().messages).toEqual([]);
      expect(store.getState().loadStatus).toBe("idle");
    });

    it("drops a sync() that finishes after reset and starts a fresh one", async () => {
      const store = await setup([message("m1")]);
      const pending = deferred<SyncOutboxResult>();
      deps.syncOutbox.execute.mockReturnValueOnce(pending.promise);
      deps.loadMessages.mockResolvedValue([message("m1")]);

      const oldSync = store.getState().sync();
      store.getState().reset();
      const freshSync = store.getState().sync();

      expect(freshSync).not.toBe(oldSync);
      pending.resolve({ offline: false, sentIds: ["m1"], failedId: null });
      await Promise.all([oldSync, freshSync]);

      expect(store.getState().messages).toEqual([]);
      expect(store.getState().syncing).toBe(false);
    });
  });

  describe("selectors", () => {
    it("counts queued and stale messages, not failed or sent ones", async () => {
      const store = await setup([
        message("queued"),
        message("stale", { createdAt: "2027-07-10T17:30:00.000Z" }),
        message("failed", { attempts: MAX_AUTO_RETRY_ATTEMPTS }),
        message("sent", { status: "sent", sentAt: NOW }),
      ]);

      expect(selectQueuedCount(store.getState())).toBe(2);
    });

    it("stops counting a message once it runs out of retry attempts", () => {
      const waiting = message("m1", {
        createdAt: NOW,
        attempts: 2,
        nextAttemptAt: "2027-07-10T18:05:00.000Z",
      });
      const exhausted = message("m1", {
        createdAt: NOW,
        attempts: MAX_AUTO_RETRY_ATTEMPTS,
        nextAttemptAt: "2027-07-10T18:05:00.000Z",
      });
      const later = new Date("2027-07-10T18:30:00.000Z");

      expect(selectQueuedCount({ messages: [waiting] }, later)).toBe(1);
      expect(selectQueuedCount({ messages: [exhausted] }, later)).toBe(0);
    });

    it("turns a queued message stale after 20 minutes", () => {
      const queued = message("m1", { createdAt: NOW });

      expect(selectDeliveryState(queued)).toBe("queued");

      jest.setSystemTime(new Date("2027-07-10T18:19:59.000Z"));
      expect(selectDeliveryState(queued)).toBe("queued");

      jest.setSystemTime(new Date("2027-07-10T18:20:00.000Z"));
      expect(selectDeliveryState(queued)).toBe("stale");
      expect(
        selectDeliveryState(queued, new Date("2027-07-10T18:05:00.000Z")),
      ).toBe("queued");
    });

    it("reports failed and sent messages", () => {
      expect(
        selectDeliveryState(message("m1", { attempts: MAX_AUTO_RETRY_ATTEMPTS })),
      ).toBe("failed");
      expect(
        selectDeliveryState(message("m2", { status: "sent", sentAt: NOW })),
      ).toBe("sent");
    });
  });
});
