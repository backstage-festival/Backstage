import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";

import type { SavedPlace } from "@/domain/entities/SavedPlace";
import {
  type PlacesError,
  placesStore,
  selectIsSavingPosition,
  selectTentPlace,
  usePlacesStore,
} from "@/store";
import { strings } from "@/strings";
import type { LoadStatus } from "@/store/optimistic";

import { buildTentRows, nextPlace, type SavedPlaceItemData, type TentRow, toSavedPlaceItemProps } from "./tentRows";
import { MOCK_GPS_ACCURACY_M, usePosition } from "./useLocation";
import { useSession } from "./useSession";

const t = strings.tent;

/** Loads the saved places of the current user once per user (S07 and 07b). */
export function usePlacesLoader(): void {
  const { userId } = useSession();
  useEffect(() => {
    void placesStore.getState().load(userId);
  }, [userId]);
}

export type TentMenu = { readonly placeId: string; readonly renaming: boolean };

export interface TentNote {
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly action?: { label: string; hint: string; onPress: () => void };
}

export interface TentScreen {
  readonly loadStatus: LoadStatus;
  readonly count: number;
  readonly tent: SavedPlaceItemData | null;
  readonly rows: readonly TentRow[];
  readonly lastError: PlacesError | null;
  readonly note: TentNote | null;
  readonly saving: boolean;
  readonly gpsMeta: string;
  readonly menu: (TentMenu & { readonly label: string }) | null;
  readonly confirm: { readonly placeId: string; readonly label: string } | null;
  readonly savePosition: () => void;
  readonly openSettings: () => void;
  readonly reload: () => void;
  readonly clearError: () => void;
  readonly openPlace: (id: string) => void;
  readonly openMenu: (id: string) => void;
  readonly openRename: (id: string) => void;
  readonly askDelete: (id: string) => void;
  readonly closeMenu: () => void;
  readonly deleteFromMenu: () => void;
  readonly rename: (label: string) => void;
  readonly cancelDelete: () => void;
  readonly confirmDelete: () => void;
}

const openSettings = (): void => {
  void Linking.openSettings();
};

const openPlace = (id: string): void => {
  router.push({ pathname: "/tent/[placeId]", params: { placeId: id } });
};

const labelOf = (saved: readonly SavedPlace[], id: string): string =>
  saved.find((place) => place.id === id)?.label ?? "";

/** The only place the S07 screen reads stores. */
export function useTentScreen(): TentScreen {
  usePlacesLoader();
  const { userId } = useSession();
  const { position } = usePosition();
  const saved = usePlacesStore((state) => state.saved);
  const loadStatus = usePlacesStore((state) => state.loadStatus);
  const pendingIds = usePlacesStore((state) => state.pendingIds);
  const lastError = usePlacesStore((state) => state.lastError);
  const saving = usePlacesStore(selectIsSavingPosition);
  const tentPlace = usePlacesStore(selectTentPlace);

  const [menu, setMenu] = useState<TentMenu | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const tent = useMemo(
    () => (tentPlace === null ? null : toSavedPlaceItemProps(tentPlace, "tent", position, pendingIds.has(tentPlace.id))),
    [tentPlace, position, pendingIds],
  );
  const rows = useMemo(
    () => buildTentRows(saved, tentPlace?.id ?? null, position, pendingIds),
    [saved, tentPlace, position, pendingIds],
  );

  const savePosition = useCallback(() => {
    const next = nextPlace(placesStore.getState().saved);
    void placesStore.getState().savePosition(next.label, next.type);
  }, []);
  const reload = useCallback(() => {
    void placesStore.getState().load(userId);
  }, [userId]);
  const clearError = useCallback(() => placesStore.getState().clearError(), []);

  const openMenu = useCallback((id: string) => setMenu({ placeId: id, renaming: false }), []);
  const openRename = useCallback((id: string) => setMenu({ placeId: id, renaming: true }), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const askDelete = useCallback((id: string) => {
    setMenu(null);
    setConfirmId(id);
  }, []);
  const deleteFromMenu = useCallback(() => {
    if (menu !== null) askDelete(menu.placeId);
  }, [menu, askDelete]);
  const cancelDelete = useCallback(() => setConfirmId(null), []);
  const confirmDelete = useCallback(() => {
    if (confirmId !== null) void placesStore.getState().remove(confirmId);
    setConfirmId(null);
  }, [confirmId]);
  const rename = useCallback(
    (label: string) => {
      if (menu !== null) void placesStore.getState().rename(menu.placeId, label);
      setMenu(null);
    },
    [menu],
  );

  return {
    loadStatus,
    count: saved.length,
    tent,
    rows,
    lastError,
    note: noteFor(lastError, savePosition),
    saving,
    gpsMeta: t.gpsMeta(t.accuracy(MOCK_GPS_ACCURACY_M)),
    menu: menu === null ? null : { ...menu, label: labelOf(saved, menu.placeId) },
    confirm: confirmId === null ? null : { placeId: confirmId, label: labelOf(saved, confirmId) },
    savePosition,
    openSettings,
    reload,
    clearError,
    openPlace,
    openMenu,
    openRename,
    askDelete,
    closeMenu,
    deleteFromMenu,
    rename,
    cancelDelete,
    confirmDelete,
  };
}

/** Inline note above the list (the list itself stays). */
function noteFor(error: PlacesError | null, retrySave: () => void): TentNote | null {
  if (error === null) return null;
  const n = t.note;
  switch (error.kind) {
    case "noLocation":
      return {
        label: t.noLocation.title,
        accessibilityLabel: n.noLocationA11y,
        action: error.permissionDenied
          ? { label: t.noLocation.openSettings, hint: t.noLocation.bodyPermission, onPress: openSettings }
          : { label: t.noLocation.retry, hint: t.noLocation.body, onPress: retrySave },
      };
    case "saveFailed":
      return { label: n.saveFailed, accessibilityLabel: n.saveFailedA11y };
    case "removeFailed":
      return { label: n.removeFailed, accessibilityLabel: n.removeFailedA11y };
    case "renameFailed":
      return { label: n.renameFailed, accessibilityLabel: n.renameFailedA11y };
    case "invalidLabel":
      return { label: n.invalidLabel, accessibilityLabel: n.invalidLabelA11y };
    case "loadFailed":
      return { label: n.loadFailed, accessibilityLabel: n.loadFailedA11y };
    case "notLoaded":
      return null;
  }
}
