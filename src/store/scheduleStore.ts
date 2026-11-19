import { createStore } from "zustand/vanilla";

import type { Concert } from "@/domain/entities/Event";
import type { ScheduleItem } from "@/domain/entities/Schedule";
import { DomainError } from "@/domain/errors/DomainError";
import { ScheduleConflictError } from "@/domain/errors/ScheduleConflictError";
import type { AddToScheduleUseCase } from "@/use-cases/AddToScheduleUseCase";

import {
  type LoadStatus,
  mergePending,
  withId,
  withoutId,
} from "./optimistic";

export interface ScheduleStoreDeps {
  readonly addToSchedule: Pick<AddToScheduleUseCase, "execute">;
  // TODO(#22/#32): provided by DI
  readonly loadSchedule: (userId: string) => Promise<readonly ScheduleItem[]>;
  // TODO(#22/#32): provided by DI
  readonly removeFromSchedule: (
    userId: string,
    concertId: string,
  ) => Promise<void>;
}

export type ScheduleError =
  | {
      readonly kind: "conflict";
      readonly concertId: string;
      readonly conflicts: readonly Concert[];
    }
  | { readonly kind: "concertNotFound"; readonly concertId: string }
  | { readonly kind: "saveFailed"; readonly concertId: string }
  | { readonly kind: "removeFailed"; readonly concertId: string }
  | { readonly kind: "loadFailed" }
  | { readonly kind: "notLoaded" };

export interface AddOptions {
  readonly allowConflict?: boolean;
}

export interface ScheduleData {
  readonly userId: string | null;
  readonly eventId: string | null;
  readonly plannedIds: ReadonlySet<string>;
  readonly items: readonly ScheduleItem[];
  readonly loadStatus: LoadStatus;
  /** Concert ids with a write in flight – UI shows "saving" and blocks taps. */
  readonly pendingIds: ReadonlySet<string>;
  readonly lastError: ScheduleError | null;
}

export interface ScheduleState extends ScheduleData {
  load(userId: string, eventId: string): Promise<boolean>;
  add(concertId: string, options?: AddOptions): Promise<boolean>;
  remove(concertId: string): Promise<boolean>;
  clearError(): void;
  /** Back to the initial state; late responses of earlier calls are dropped. */
  reset(): void;
}

export type ScheduleStore = ReturnType<typeof createScheduleStore>;

const initialScheduleData = (): ScheduleData => ({
  userId: null,
  eventId: null,
  plannedIds: new Set<string>(),
  items: [],
  loadStatus: "idle",
  pendingIds: new Set<string>(),
  lastError: null,
});

const toAddError = (error: unknown, concertId: string): ScheduleError => {
  if (error instanceof ScheduleConflictError) {
    return { kind: "conflict", concertId, conflicts: error.conflicts };
  }
  if (error instanceof DomainError && error.code === "CONCERT_NOT_FOUND") {
    return { kind: "concertNotFound", concertId };
  }
  return { kind: "saveFailed", concertId };
};

const idOf = (item: ScheduleItem): string => item.concertId;

const plannedIdsOf = (items: readonly ScheduleItem[]): ReadonlySet<string> =>
  new Set(items.map(idOf));

export function createScheduleStore(deps: ScheduleStoreDeps) {
  // Guards against an older load() overwriting a newer one.
  let loadToken = 0;
  // Bumped by reset(): write actions started before it must not touch the new state.
  let epoch = 0;

  return createStore<ScheduleState>()((set, get) => ({
    ...initialScheduleData(),

    async load(userId, eventId) {
      const token = ++loadToken;
      set({ userId, eventId, loadStatus: "loading" });
      try {
        const loaded = await deps.loadSchedule(userId);
        if (token !== loadToken) return false;
        const { items, pendingIds } = get();
        const merged = mergePending(loaded, items, pendingIds, idOf);
        set({
          items: merged,
          plannedIds: plannedIdsOf(merged),
          loadStatus: "ready",
        });
        return true;
      } catch {
        if (token !== loadToken) return false;
        set({ loadStatus: "error", lastError: { kind: "loadFailed" } });
        return false;
      }
    },

    async add(concertId, options) {
      const { userId, eventId, pendingIds, plannedIds } = get();
      if (userId === null || eventId === null) {
        set({ lastError: { kind: "notLoaded" } });
        return false;
      }
      if (pendingIds.has(concertId)) return false;
      if (plannedIds.has(concertId)) return true;
      const startedIn = epoch;

      // 1. Optimistic change in RAM (0 ms).
      const optimistic: ScheduleItem = {
        userId,
        concertId,
        addedAt: new Date().toISOString(),
      };
      set((state) => ({
        items: [...state.items, optimistic],
        plannedIds: withId(state.plannedIds, concertId),
        pendingIds: withId(state.pendingIds, concertId),
        lastError: null,
      }));

      try {
        const result = await deps.addToSchedule.execute({
          userId,
          eventId,
          concertId,
          allowConflict: options?.allowConflict,
        });
        if (startedIn !== epoch) return true;
        set((state) => ({
          // "already_planned" keeps the optimistic item – the concert is planned either way.
          items:
            result.status === "added"
              ? state.items.map((item) =>
                  item.concertId === concertId ? result.item : item,
                )
              : state.items,
          pendingIds: withoutId(state.pendingIds, concertId),
        }));
        return true;
      } catch (error) {
        if (startedIn !== epoch) return false;
        // 2. Roll back only this concert, not a snapshot of the whole state.
        set((state) => ({
          items: state.items.filter((item) => item.concertId !== concertId),
          plannedIds: withoutId(state.plannedIds, concertId),
          pendingIds: withoutId(state.pendingIds, concertId),
          lastError: toAddError(error, concertId),
        }));
        return false;
      }
    },

    async remove(concertId) {
      const { userId, pendingIds, items } = get();
      if (userId === null) {
        set({ lastError: { kind: "notLoaded" } });
        return false;
      }
      if (pendingIds.has(concertId)) return false;
      const index = items.findIndex((item) => item.concertId === concertId);
      const removed = items[index];
      if (removed === undefined) return true;
      const startedIn = epoch;

      set((state) => ({
        items: state.items.filter((item) => item.concertId !== concertId),
        plannedIds: withoutId(state.plannedIds, concertId),
        pendingIds: withId(state.pendingIds, concertId),
        lastError: null,
      }));

      try {
        await deps.removeFromSchedule(userId, concertId);
        if (startedIn !== epoch) return true;
        set((state) => ({
          pendingIds: withoutId(state.pendingIds, concertId),
        }));
        return true;
      } catch {
        if (startedIn !== epoch) return false;
        set((state) => {
          const restored = [...state.items];
          restored.splice(Math.min(index, restored.length), 0, removed);
          return {
            items: restored,
            plannedIds: withId(state.plannedIds, concertId),
            pendingIds: withoutId(state.pendingIds, concertId),
            lastError: { kind: "removeFailed", concertId },
          };
        });
        return false;
      }
    },

    clearError() {
      set({ lastError: null });
    },

    reset() {
      loadToken += 1;
      epoch += 1;
      set(initialScheduleData());
    },
  }));
}

export const selectIsPlanned =
  (concertId: string) =>
  (state: ScheduleState): boolean =>
    state.plannedIds.has(concertId);

export const selectIsSchedulePending =
  (concertId: string) =>
  (state: ScheduleState): boolean =>
    state.pendingIds.has(concertId);
