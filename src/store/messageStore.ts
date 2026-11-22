import { createStore } from "zustand/vanilla";

import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import { DomainError } from "@/domain/errors/DomainError";
import {
  getMessageDeliveryState,
  type MessageDeliveryState,
} from "@/domain/utils/messageStaleness";
import type { QueueMessageUseCase } from "@/use-cases/QueueMessageUseCase";
import type { RetryMessageUseCase } from "@/use-cases/RetryMessageUseCase";
import type { SyncOutboxUseCase } from "@/use-cases/SyncOutboxUseCase";

import {
  type LoadStatus,
  mergePending,
  unionIds,
  withId,
  withoutId,
} from "./optimistic";

export interface MessageStoreDeps {
  readonly queueMessage: Pick<QueueMessageUseCase, "execute">;
  readonly retryMessage: Pick<RetryMessageUseCase, "execute">;
  readonly syncOutbox: Pick<SyncOutboxUseCase, "execute">;
  // TODO(#22/#32): provided by DI
  readonly loadMessages: (crewId: string) => Promise<readonly OutboxMessage[]>;
}

export type MessageError =
  | { readonly kind: "invalidBody" }
  | { readonly kind: "sendFailed" }
  | { readonly kind: "messageNotFound"; readonly messageId: string }
  | { readonly kind: "retryFailed"; readonly messageId: string }
  | { readonly kind: "syncFailed" }
  | { readonly kind: "loadFailed" }
  | { readonly kind: "notLoaded" };

export interface MessageData {
  readonly crewId: string | null;
  readonly messages: readonly OutboxMessage[];
  readonly loadStatus: LoadStatus;
  /** Message ids with a write in flight (temporary `local-<n>` ids included). */
  readonly pendingIds: ReadonlySet<string>;
  readonly syncing: boolean;
  readonly lastError: MessageError | null;
}

export interface MessageState extends MessageData {
  load(crewId: string): Promise<boolean>;
  send(body: string, authorId: string): Promise<boolean>;
  retry(messageId: string): Promise<boolean>;
  /** Never throws – a failed sync only sets lastError. */
  sync(): Promise<void>;
  clearError(): void;
  /** Back to the initial state; late load()/sync() responses are dropped. */
  reset(): void;
}

export type MessageStore = ReturnType<typeof createMessageStore>;

export const LOCAL_MESSAGE_ID_PREFIX = "local-";

const initialMessageData = (): MessageData => ({
  crewId: null,
  messages: [],
  loadStatus: "idle",
  pendingIds: new Set<string>(),
  syncing: false,
  lastError: null,
});

const idOf = (message: OutboxMessage): string => message.id;

const byCreatedAt = (a: OutboxMessage, b: OutboxMessage): number =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

const toSendError = (error: unknown): MessageError =>
  error instanceof DomainError && error.code === "INVALID_MESSAGE_BODY"
    ? { kind: "invalidBody" }
    : { kind: "sendFailed" };

const toRetryError = (error: unknown, messageId: string): MessageError =>
  error instanceof DomainError && error.code === "MESSAGE_NOT_FOUND"
    ? { kind: "messageNotFound", messageId }
    : { kind: "retryFailed", messageId };

export function createMessageStore(deps: MessageStoreDeps) {
  let localCounter = 0;
  let loadToken = 0;
  // Bumped by reset(): actions and syncs started before it must not touch the new state.
  let epoch = 0;
  // Ids written (saved or rolled back) since the current load started –
  // their local state is newer than whatever that load returns.
  let settledIds = new Set<string>();
  let inFlightSync: Promise<void> | null = null;
  // Set by sync() while a pass is running: the chain runs one more pass.
  let rerunRequested = false;

  return createStore<MessageState>()((set, get) => {
    /** Loads the crew list; local state wins for messages written meanwhile. */
    const reload = async (crewId: string, token: number): Promise<boolean> => {
      settledIds = new Set<string>();
      const loaded = await deps.loadMessages(crewId);
      if (token !== loadToken || get().crewId !== crewId) return false;
      const { messages, pendingIds } = get();
      set({
        messages: [
          ...mergePending(
            loaded,
            messages,
            unionIds(pendingIds, settledIds),
            idOf,
          ),
        ].sort(byCreatedAt),
        loadStatus: "ready",
      });
      return true;
    };

    /** One pass: push the outbox, then reload the list if we were online. */
    const runSyncPass = async (startedIn: number): Promise<void> => {
      let result;
      try {
        result = await deps.syncOutbox.execute();
      } catch {
        if (startedIn === epoch) set({ lastError: { kind: "syncFailed" } });
        return;
      }
      const { crewId } = get();
      if (result.offline || crewId === null || startedIn !== epoch) return;

      // This reload supersedes a load() in flight, so it must settle loadStatus.
      const token = ++loadToken;
      try {
        await reload(crewId, token);
      } catch {
        if (token !== loadToken) return;
        set((state) => ({
          lastError: { kind: "syncFailed" },
          loadStatus:
            state.loadStatus === "loading" ? "error" : state.loadStatus,
        }));
      }
    };

    /**
     * Runs passes until nobody asks for another one. A pass reads the outbox
     * once, so a message queued during it needs a fresh pass – started only
     * after the previous one settled, so SyncOutboxUseCase does not hand back
     * its in-flight promise. `syncing` stays true for the whole chain.
     */
    const runSyncChain = async (startedIn: number): Promise<void> => {
      set({ syncing: true });
      try {
        do {
          rerunRequested = false;
          await runSyncPass(startedIn);
        } while (rerunRequested && startedIn === epoch);
      } finally {
        if (startedIn === epoch) set({ syncing: false });
      }
    };

    return {
      ...initialMessageData(),

      async load(crewId) {
        const token = ++loadToken;
        if (get().crewId !== crewId) {
          set({ crewId, messages: [], pendingIds: new Set<string>() });
        }
        set({ loadStatus: "loading" });
        try {
          return await reload(crewId, token);
        } catch {
          if (token !== loadToken) return false;
          set({ loadStatus: "error", lastError: { kind: "loadFailed" } });
          return false;
        }
      },

      async send(body, authorId) {
        const { crewId } = get();
        if (crewId === null) {
          set({ lastError: { kind: "notLoaded" } });
          return false;
        }
        const startedIn = epoch;

        // QueueMessageUseCase assigns the real id, so show a temporary one first.
        localCounter += 1;
        const tempId = `${LOCAL_MESSAGE_ID_PREFIX}${localCounter}`;
        const optimistic: OutboxMessage = {
          id: tempId,
          crewId,
          authorId,
          body,
          status: "queued",
          attempts: 0,
          createdAt: new Date().toISOString(),
          nextAttemptAt: null,
          sentAt: null,
        };
        set((state) => ({
          messages: [...state.messages, optimistic],
          pendingIds: withId(state.pendingIds, tempId),
          lastError: null,
        }));

        try {
          const queued = await deps.queueMessage.execute({
            crewId,
            authorId,
            body,
          });
          if (startedIn !== epoch) return true;
          // The temporary id is gone; protect the real one from a stale load.
          settledIds.add(queued.id);
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === tempId ? queued : message,
            ),
            pendingIds: withoutId(state.pendingIds, tempId),
          }));
          void get().sync();
          return true;
        } catch (error) {
          if (startedIn !== epoch) return false;
          set((state) => ({
            messages: state.messages.filter((message) => message.id !== tempId),
            pendingIds: withoutId(state.pendingIds, tempId),
            lastError: toSendError(error),
          }));
          return false;
        }
      },

      async retry(messageId) {
        const { pendingIds, messages } = get();
        if (pendingIds.has(messageId)) return false;
        const previous = messages.find((message) => message.id === messageId);
        if (previous === undefined) {
          set({ lastError: { kind: "messageNotFound", messageId } });
          return false;
        }
        const startedIn = epoch;

        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === messageId
              ? { ...message, attempts: 0, nextAttemptAt: null }
              : message,
          ),
          pendingIds: withId(state.pendingIds, messageId),
          lastError: null,
        }));

        try {
          await deps.retryMessage.execute(messageId);
          if (startedIn !== epoch) return true;
          settledIds.add(messageId);
          set((state) => ({
            pendingIds: withoutId(state.pendingIds, messageId),
          }));
          void get().sync();
          return true;
        } catch (error) {
          if (startedIn !== epoch) return false;
          settledIds.add(messageId);
          // Restore only the fields this action changed.
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    attempts: previous.attempts,
                    nextAttemptAt: previous.nextAttemptAt,
                  }
                : message,
            ),
            pendingIds: withoutId(state.pendingIds, messageId),
            lastError: toRetryError(error, messageId),
          }));
          return false;
        }
      },

      sync() {
        if (inFlightSync !== null) {
          // The running pass may have read the outbox before this caller's write.
          rerunRequested = true;
          return inFlightSync;
        }
        const current = runSyncChain(epoch).finally(() => {
          if (inFlightSync === current) inFlightSync = null;
        });
        inFlightSync = current;
        return current;
      },

      clearError() {
        set({ lastError: null });
      },

      reset() {
        loadToken += 1;
        epoch += 1;
        settledIds = new Set<string>();
        // The old chain may still finish its pass, but it is no longer shared
        // with new callers and never starts another pass.
        inFlightSync = null;
        rerunRequested = false;
        set(initialMessageData());
      },
    };
  });
}

/**
 * Selectors run during render, so they must not throw. The domain rule throws
 * DomainError for an unparsable createdAt; such a message is shown as
 * "queued" (it is still in the outbox). Any other error is a bug and rethrown.
 */
const safeDeliveryState = (
  message: OutboxMessage,
  now: Date,
): MessageDeliveryState => {
  try {
    return getMessageDeliveryState(message, now);
  } catch (error) {
    if (error instanceof DomainError) return "queued";
    throw error;
  }
};

/** `now` is passed in so a screen can re-render on its own clock tick. */
export const selectDeliveryState = (
  message: OutboxMessage,
  now: Date = new Date(),
): MessageDeliveryState => safeDeliveryState(message, now);

/** Messages still waiting for delivery: "queued" or "stale", not "failed" or "sent". */
export const selectQueuedCount = (
  state: Pick<MessageState, "messages">,
  now: Date = new Date(),
): number =>
  state.messages.reduce((count, message) => {
    const delivery = safeDeliveryState(message, now);
    return delivery === "queued" || delivery === "stale" ? count + 1 : count;
  }, 0);

export const selectIsMessagePending =
  (messageId: string) =>
  (state: MessageState): boolean =>
    state.pendingIds.has(messageId);
