import { createStore } from "zustand/vanilla";

import type { CheckIn } from "@/domain/entities/Schedule";
import { DomainError } from "@/domain/errors/DomainError";
import { TooFarFromStageError } from "@/domain/errors/TooFarFromStageError";
import type { CheckInUseCase } from "@/use-cases/CheckInUseCase";

import { type LoadStatus, unionIds, withId, withoutId } from "./optimistic";

export interface CheckInStoreDeps {
  readonly checkIn: Pick<CheckInUseCase, "execute">;
  // TODO(#22/#32): provided by DI
  readonly loadCheckIns: (userId: string) => Promise<readonly CheckIn[]>;
}

export type CheckInError =
  | {
      readonly kind: "tooFar";
      readonly concertId: string;
      readonly distanceMeters: number;
    }
  | { readonly kind: "closed"; readonly concertId: string }
  | { readonly kind: "locationUnavailable"; readonly concertId: string }
  | { readonly kind: "saveFailed"; readonly concertId: string }
  | { readonly kind: "loadFailed" };

export interface CheckInData {
  readonly checkedInConcertIds: ReadonlySet<string>;
  readonly loadStatus: LoadStatus;
  readonly pendingIds: ReadonlySet<string>;
  readonly lastError: CheckInError | null;
}

export interface CheckInState extends CheckInData {
  load(userId: string): Promise<boolean>;
  checkIn(userId: string, eventId: string, concertId: string): Promise<boolean>;
  clearError(): void;
  /** Back to the initial state; late responses of earlier calls are dropped. */
  reset(): void;
}

export type CheckInStore = ReturnType<typeof createCheckInStore>;

const initialCheckInData = (): CheckInData => ({
  checkedInConcertIds: new Set<string>(),
  loadStatus: "idle",
  pendingIds: new Set<string>(),
  lastError: null,
});

const toCheckInError = (error: unknown, concertId: string): CheckInError => {
  if (error instanceof TooFarFromStageError) {
    return { kind: "tooFar", concertId, distanceMeters: error.distanceMeters };
  }
  if (error instanceof DomainError) {
    switch (error.code) {
      case "CHECK_IN_CLOSED":
        return { kind: "closed", concertId };
      case "LOCATION_UNAVAILABLE":
        return { kind: "locationUnavailable", concertId };
      default:
        return { kind: "saveFailed", concertId };
    }
  }
  return { kind: "saveFailed", concertId };
};

export function createCheckInStore(deps: CheckInStoreDeps) {
  let loadToken = 0;
  // Bumped by reset(): write actions started before it must not touch the new state.
  let epoch = 0;
  // Ids written (saved or rolled back) since the current load started –
  // their local state is newer than whatever that load returns.
  let settledIds = new Set<string>();

  return createStore<CheckInState>()((set, get) => ({
    ...initialCheckInData(),

    async load(userId) {
      const token = ++loadToken;
      settledIds = new Set<string>();
      set({ loadStatus: "loading" });
      try {
        const checkIns = await deps.loadCheckIns(userId);
        if (token !== loadToken) return false;
        const ids = new Set(checkIns.map((checkIn) => checkIn.concertId));
        // Local state wins for writes in flight or settled since this load started.
        const { pendingIds, checkedInConcertIds } = get();
        for (const id of unionIds(pendingIds, settledIds)) {
          if (checkedInConcertIds.has(id)) ids.add(id);
          else ids.delete(id);
        }
        set({ checkedInConcertIds: ids, loadStatus: "ready" });
        return true;
      } catch {
        if (token !== loadToken) return false;
        set({ loadStatus: "error", lastError: { kind: "loadFailed" } });
        return false;
      }
    },

    async checkIn(userId, eventId, concertId) {
      const { pendingIds, checkedInConcertIds } = get();
      if (pendingIds.has(concertId)) return false;
      if (checkedInConcertIds.has(concertId)) return true;
      const startedIn = epoch;

      set((state) => ({
        checkedInConcertIds: withId(state.checkedInConcertIds, concertId),
        pendingIds: withId(state.pendingIds, concertId),
        lastError: null,
      }));

      try {
        // Both "checked_in" and "already_checked_in" keep the mark.
        await deps.checkIn.execute({ userId, eventId, concertId });
        if (startedIn !== epoch) return true;
        settledIds.add(concertId);
        set((state) => ({
          pendingIds: withoutId(state.pendingIds, concertId),
        }));
        return true;
      } catch (error) {
        if (startedIn !== epoch) return false;
        settledIds.add(concertId);
        // Validation errors (distance, window, GPS) also roll back.
        set((state) => ({
          checkedInConcertIds: withoutId(state.checkedInConcertIds, concertId),
          pendingIds: withoutId(state.pendingIds, concertId),
          lastError: toCheckInError(error, concertId),
        }));
        return false;
      }
    },

    clearError() {
      set({ lastError: null });
    },

    reset() {
      loadToken += 1;
      epoch += 1;
      settledIds = new Set<string>();
      set(initialCheckInData());
    },
  }));
}

export const selectIsCheckedIn =
  (concertId: string) =>
  (state: CheckInState): boolean =>
    state.checkedInConcertIds.has(concertId);

export const selectIsCheckInPending =
  (concertId: string) =>
  (state: CheckInState): boolean =>
    state.pendingIds.has(concertId);
