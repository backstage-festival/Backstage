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
  let inFlightSync: Promise<void> | null = null;

  return createStore<MessageState>()((set, get) => {
    /** Loads the crew list and keeps local optimistic messages that are still pending. */
    const reload = async (crewId: string, token: number): Promise<boolean> => {
      const loaded = await deps.loadMessages(crewId);
      if (token !== loadToken || get().crewId !== crewId) return false;
      const { messages, pendingIds } = get();
      set({
        messages: [...mergePending(loaded, messages, pendingIds, idOf)].sort(
          byCreatedAt,
        ),
        loadStatus: "ready",
      });
      return true;
    };

    const runSync = async (startedIn: number): Promise<void> => {
      set({ syncing: true });
      try {
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
          set((state) => ({
            pendingIds: withoutId(state.pendingIds, messageId),
          }));
          void get().sync();
          return true;
        } catch (error) {
          if (startedIn !== epoch) return false;
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
        if (inFlightSync === null) {
          const current = runSync(epoch).finally(() => {
            if (inFlightSync === current) inFlightSync = null;
          });
          inFlightSync = current;
        }
        return inFlightSync;
      },

      clearError() {
        set({ lastError: null });
      },

      reset() {
        loadToken += 1;
        epoch += 1;
        // The old sync may still finish, but it is no longer shared with new callers.
        inFlightSync = null;
        set(initialMessageData());
      },
    };
  });
}

/** `now` is passed in so a screen can re-render on its own clock tick. */
export const selectDeliveryState = (
  message: OutboxMessage,
  now: Date = new Date(),
): MessageDeliveryState => getMessageDeliveryState(message, now);

/** Messages still waiting for delivery: "queued" or "stale", not "failed" or "sent". */
export const selectQueuedCount = (
  state: Pick<MessageState, "messages">,
  now: Date = new Date(),
): number =>
  state.messages.reduce((count, message) => {
    const delivery = getMessageDeliveryState(message, now);
    return delivery === "queued" || delivery === "stale" ? count + 1 : count;
  }, 0);

export const selectIsMessagePending =
  (messageId: string) =>
  (state: MessageState): boolean =>
    state.pendingIds.has(messageId);
