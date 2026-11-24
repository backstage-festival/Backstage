import { createStore } from "zustand/vanilla";

import type { Coordinates } from "@/domain/entities/common";
import type { SavedPlace, SavedPlaceType } from "@/domain/entities/SavedPlace";
import { DomainError } from "@/domain/errors/DomainError";
import type { ILocationService } from "@/domain/repositories/ILocationService";
import { MAX_PLACE_LABEL_LENGTH, normalizeText } from "@/domain/utils/textRules";
import type { SavePlaceUseCase } from "@/use-cases/SavePlaceUseCase";

import { type LoadStatus, mergePending, unionIds, withId, withoutId } from "./optimistic";

export interface PlacesStoreDeps {
  readonly savePlace: Pick<SavePlaceUseCase, "execute">;
  readonly location: Pick<ILocationService, "requestPermissions" | "getCurrentPosition">;
  // TODO(#32): ISavedPlaceRepository.getForUser via DI
  readonly loadPlaces: (userId: string) => Promise<readonly SavedPlace[]>;
  // TODO(#32): ISavedPlaceRepository.remove via DI – no use case yet (question to Marceli)
  readonly removePlace: (placeId: string) => Promise<void>;
  /**
   * Rename = ISavedPlaceRepository.save with the same id (upsert).
   * TODO(#32): confirm save() is an upsert, or add a rename use case (question to Marceli).
   */
  readonly renamePlace: (place: SavedPlace) => Promise<void>;
}

export type PlacesError =
  /** No permission or no GPS fix. `permissionDenied` → „Otwórz ustawienia”. */
  | { readonly kind: "noLocation"; readonly permissionDenied: boolean }
  | { readonly kind: "invalidLabel" }
  | { readonly kind: "saveFailed" }
  | { readonly kind: "removeFailed"; readonly placeId: string }
  | { readonly kind: "renameFailed"; readonly placeId: string }
  | { readonly kind: "loadFailed" }
  | { readonly kind: "notLoaded" };

export interface PlacesData {
  readonly userId: string | null;
  /** Newest first, like ISavedPlaceRepository.getForUser (ORDER BY saved_at DESC). */
  readonly saved: readonly SavedPlace[];
  readonly loadStatus: LoadStatus;
  /** Place ids with a write in flight (temporary `local-<n>` ids included). */
  readonly pendingIds: ReadonlySet<string>;
  /** Waiting for the permission dialog or the GPS fix of savePosition(). */
  readonly locating: boolean;
  readonly lastError: PlacesError | null;
}

export interface PlacesState extends PlacesData {
  load(userId: string): Promise<boolean>;
  /** Saves the current GPS position. The row shows up before the write finishes. */
  savePosition(label: string, type: SavedPlaceType): Promise<boolean>;
  /** Call after the user confirmed (ConfirmDialog). Rolls back to the same list position. */
  remove(placeId: string): Promise<boolean>;
  rename(placeId: string, label: string): Promise<boolean>;
  clearError(): void;
  /** Back to the initial state; late responses of earlier calls are dropped. */
  reset(): void;
}

export type PlacesStore = ReturnType<typeof createPlacesStore>;

export const LOCAL_PLACE_ID_PREFIX = "local-";

const initialPlacesData = (): PlacesData => ({
  userId: null,
  saved: [],
  loadStatus: "idle",
  pendingIds: new Set<string>(),
  locating: false,
  lastError: null,
});

const idOf = (place: SavedPlace): string => place.id;

const byNewest = (a: SavedPlace, b: SavedPlace): number => Date.parse(b.savedAt) - Date.parse(a.savedAt);

const toSaveError = (error: unknown): PlacesError => {
  if (error instanceof DomainError) {
    if (error.code === "INVALID_PLACE_LABEL") return { kind: "invalidLabel" };
    if (error.code === "LOCATION_UNAVAILABLE" || error.code === "INVALID_COORDINATES") {
      return { kind: "noLocation", permissionDenied: false };
    }
  }
  return { kind: "saveFailed" };
};

export function createPlacesStore(deps: PlacesStoreDeps) {
  let localCounter = 0;
  let loadToken = 0;
  // Bumped by reset(): actions started before it must not touch the new state.
  let epoch = 0;
  // Ids written (saved, removed, rolled back) since the current load started.
  let settledIds = new Set<string>();

  return createStore<PlacesState>()((set, get) => ({
    ...initialPlacesData(),

    async load(userId) {
      const token = ++loadToken;
      settledIds = new Set<string>();
      if (get().userId !== userId) {
        set({ userId, saved: [], pendingIds: new Set<string>() });
      }
      set({ loadStatus: "loading" });
      try {
        const loaded = await deps.loadPlaces(userId);
        if (token !== loadToken) return false;
        const { saved, pendingIds } = get();
        const merged = mergePending(loaded, saved, unionIds(pendingIds, settledIds), idOf);
        set({ saved: [...merged].sort(byNewest), loadStatus: "ready" });
        return true;
      } catch {
        if (token !== loadToken) return false;
        set({ loadStatus: "error", lastError: { kind: "loadFailed" } });
        return false;
      }
    },

    async savePosition(label, type) {
      const { userId, locating } = get();
      if (userId === null) {
        set({ lastError: { kind: "notLoaded" } });
        return false;
      }
      if (locating) return false;
      const normalized = normalizeText(label, MAX_PLACE_LABEL_LENGTH);
      if (normalized === null) {
        set({ lastError: { kind: "invalidLabel" } });
        return false;
      }
      const startedIn = epoch;

      // GPS first: the optimistic row needs a position.
      set({ locating: true, lastError: null });
      let location: Coordinates | null;
      try {
        const granted = await deps.location.requestPermissions();
        if (startedIn !== epoch) return false;
        if (!granted) {
          set({ locating: false, lastError: { kind: "noLocation", permissionDenied: true } });
          return false;
        }
        location = await deps.location.getCurrentPosition();
      } catch {
        location = null;
      }
      if (startedIn !== epoch) return false;
      if (location === null) {
        set({ locating: false, lastError: { kind: "noLocation", permissionDenied: false } });
        return false;
      }

      // 1. Optimistic row with a temporary id (SavePlaceUseCase assigns the real one).
      localCounter += 1;
      const tempId = `${LOCAL_PLACE_ID_PREFIX}${localCounter}`;
      const optimistic: SavedPlace = {
        id: tempId,
        userId,
        label: normalized,
        type,
        location,
        savedAt: new Date().toISOString(),
      };
      set((state) => ({
        saved: [optimistic, ...state.saved],
        pendingIds: withId(state.pendingIds, tempId),
        locating: false,
      }));

      try {
        const result = await deps.savePlace.execute({ userId, label: normalized, type, location });
        if (startedIn !== epoch) return true;
        // The temporary id is gone; protect the real one (and the replaced tents) from a stale load.
        settledIds.add(result.place.id);
        for (const id of result.replacedIds) settledIds.add(id);
        const replaced = new Set(result.replacedIds);
        set((state) => ({
          saved: state.saved
            .filter((place) => !replaced.has(place.id))
            .map((place) => (place.id === tempId ? result.place : place)),
          pendingIds: withoutId(state.pendingIds, tempId),
        }));
        return true;
      } catch (error) {
        if (startedIn !== epoch) return false;
        // 2. Roll back only this row.
        set((state) => ({
          saved: state.saved.filter((place) => place.id !== tempId),
          pendingIds: withoutId(state.pendingIds, tempId),
          lastError: toSaveError(error),
        }));
        return false;
      }
    },

    async remove(placeId) {
      const { userId, pendingIds, saved } = get();
      if (userId === null) {
        set({ lastError: { kind: "notLoaded" } });
        return false;
      }
      if (pendingIds.has(placeId)) return false;
      const index = saved.findIndex((place) => place.id === placeId);
      const removed = saved[index];
      if (removed === undefined) return true;
      const startedIn = epoch;

      set((state) => ({
        saved: state.saved.filter((place) => place.id !== placeId),
        pendingIds: withId(state.pendingIds, placeId),
        lastError: null,
      }));

      try {
        await deps.removePlace(placeId);
        if (startedIn !== epoch) return true;
        settledIds.add(placeId);
        set((state) => ({ pendingIds: withoutId(state.pendingIds, placeId) }));
        return true;
      } catch {
        if (startedIn !== epoch) return false;
        settledIds.add(placeId);
        // Back where it was (rows added meanwhile may shift it, so clamp).
        set((state) => {
          const restored = [...state.saved];
          restored.splice(Math.min(index, restored.length), 0, removed);
          return {
            saved: restored,
            pendingIds: withoutId(state.pendingIds, placeId),
            lastError: { kind: "removeFailed", placeId },
          };
        });
        return false;
      }
    },

    async rename(placeId, label) {
      const { userId, pendingIds, saved } = get();
      if (userId === null) {
        set({ lastError: { kind: "notLoaded" } });
        return false;
      }
      if (pendingIds.has(placeId)) return false;
      const previous = saved.find((place) => place.id === placeId);
      if (previous === undefined) return false;
      const normalized = normalizeText(label, MAX_PLACE_LABEL_LENGTH);
      if (normalized === null) {
        set({ lastError: { kind: "invalidLabel" } });
        return false;
      }
      if (normalized === previous.label) return true;
      const startedIn = epoch;
      const renamed: SavedPlace = { ...previous, label: normalized };

      set((state) => ({
        saved: state.saved.map((place) => (place.id === placeId ? renamed : place)),
        pendingIds: withId(state.pendingIds, placeId),
        lastError: null,
      }));

      try {
        await deps.renamePlace(renamed);
        if (startedIn !== epoch) return true;
        settledIds.add(placeId);
        set((state) => ({ pendingIds: withoutId(state.pendingIds, placeId) }));
        return true;
      } catch {
        if (startedIn !== epoch) return false;
        settledIds.add(placeId);
        // Restore only the label this action changed.
        set((state) => ({
          saved: state.saved.map((place) => (place.id === placeId ? { ...place, label: previous.label } : place)),
          pendingIds: withoutId(state.pendingIds, placeId),
          lastError: { kind: "renameFailed", placeId },
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
      set(initialPlacesData());
    },
  }));
}

export const selectIsPlacePending =
  (placeId: string) =>
  (state: PlacesState): boolean =>
    state.pendingIds.has(placeId);

/** „Zapisz moją pozycję” is busy while locating or while a new row is being written. */
export const selectIsSavingPosition = (state: PlacesState): boolean =>
  state.locating || [...state.pendingIds].some((id) => id.startsWith(LOCAL_PLACE_ID_PREFIX));

/** S07 tent pass: the first (newest) place of type tent. Returns a stored object, never a new one. */
export const selectTentPlace = (state: PlacesState): SavedPlace | null =>
  state.saved.find((place) => place.type === "tent") ?? null;

export const selectPlace =
  (placeId: string) =>
  (state: PlacesState): SavedPlace | null =>
    state.saved.find((place) => place.id === placeId) ?? null;
