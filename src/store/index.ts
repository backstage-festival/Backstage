import { useStore } from "zustand";

import {
  authDeps,
  checkInDeps,
  connectionDeps,
  lineupDeps,
  messageDeps,
  placesDeps,
  scheduleDeps,
  settingsDeps,
  transitDeps,
} from "@/di/container";

import { type AuthState, createAuthStore } from "./authStore";
import { type CheckInState, createCheckInStore } from "./checkInStore";
import { type ConnectionState, createConnectionStore } from "./connectionStore";
import { createLineupStore, type LineupState } from "./lineupStore";
import { createMessageStore, type MessageState } from "./messageStore";
import { createPlacesStore, type PlacesState } from "./placesStore";
import { resetOnLogout } from "./resetOnLogout";
import { createScheduleStore, type ScheduleState } from "./scheduleStore";
import { createSettingsStore, type SettingsState } from "./settingsStore";
import { createTransitStore, type TransitState } from "./transitStore";

export const scheduleStore = createScheduleStore(scheduleDeps);
export const messageStore = createMessageStore(messageDeps);
export const checkInStore = createCheckInStore(checkInDeps);
export const authStore = createAuthStore(authDeps);
export const settingsStore = createSettingsStore(settingsDeps);
export const placesStore = createPlacesStore(placesDeps);
export const connectionStore = createConnectionStore({
  ...connectionDeps,
  onOnline: () => {
    void messageStore.getState().sync();
  },
});

export const lineupStore = createLineupStore(lineupDeps);
export const transitStore = createTransitStore(transitDeps);

resetOnLogout(authStore, [scheduleStore, messageStore, checkInStore, settingsStore, placesStore]);

export function useScheduleStore<T>(selector: (state: ScheduleState) => T): T {
  return useStore(scheduleStore, selector);
}

export function useMessageStore<T>(selector: (state: MessageState) => T): T {
  return useStore(messageStore, selector);
}

export function useCheckInStore<T>(selector: (state: CheckInState) => T): T {
  return useStore(checkInStore, selector);
}

export function useConnectionStore<T>(
  selector: (state: ConnectionState) => T,
): T {
  return useStore(connectionStore, selector);
}

export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  return useStore(authStore, selector);
}

export function useLineupStore<T>(selector: (state: LineupState) => T): T {
  return useStore(lineupStore, selector);
}

export function usePlacesStore<T>(selector: (state: PlacesState) => T): T {
  return useStore(placesStore, selector);
}

export function useSettingsStore<T>(selector: (state: SettingsState) => T): T {
  return useStore(settingsStore, selector);
}

export function useTransitStore<T>(selector: (state: TransitState) => T): T {
  return useStore(transitStore, selector);
}

export { selectIsSignedIn } from "./authStore";
export type { AuthError, SessionUser } from "./authStore";
export { selectIsCheckedIn, selectIsCheckInPending } from "./checkInStore";
export type { CheckInError } from "./checkInStore";
export { toConnectionBarState } from "./connectionStore";
export { selectHasLineup } from "./lineupStore";
export type { Lineup, LineupError } from "./lineupStore";
export {
  selectDeliveryState,
  selectIsMessagePending,
  selectQueuedCount,
} from "./messageStore";
export type { MessageError } from "./messageStore";
export {
  LOCAL_PLACE_ID_PREFIX,
  selectIsPlacePending,
  selectIsSavingPosition,
  selectPlace,
  selectTentPlace,
} from "./placesStore";
export type { PlacesError } from "./placesStore";
export { selectIsPlanned, selectIsSchedulePending } from "./scheduleStore";
export type { ScheduleError } from "./scheduleStore";
export { DEFAULT_SETTINGS, selectIsSettingPending } from "./settingsStore";
export type {
  AccessibilitySettings,
  LeaveNowAlertSetting,
  SettingKey,
  SettingsError,
  SnoozeMinutes,
} from "./settingsStore";
export {
  departsAtMs,
  selectDepartureState,
  selectTransitFreshness,
  selectUpcomingDepartures,
} from "./transitStore";
export type { TransitError } from "./transitStore";
