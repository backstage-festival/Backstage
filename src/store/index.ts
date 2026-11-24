import { useStore } from "zustand";

import {
  mockAuthDeps,
  mockCheckInDeps,
  mockLineupDeps,
  mockMessageDeps,
  mockNetworkService,
  mockScheduleDeps,
  mockSettingsDeps,
  mockTransitDeps,
} from "@/mocks/mockStoreDeps";

import { type AuthState, createAuthStore } from "./authStore";
import { type CheckInState, createCheckInStore } from "./checkInStore";
import { type ConnectionState, createConnectionStore } from "./connectionStore";
import { createLineupStore, type LineupState } from "./lineupStore";
import { createMessageStore, type MessageState } from "./messageStore";
import { resetOnLogout } from "./resetOnLogout";
import { createScheduleStore, type ScheduleState } from "./scheduleStore";
import { createSettingsStore, type SettingsState } from "./settingsStore";
import { createTransitStore, type TransitState } from "./transitStore";

// TEMP: mock deps until #32 (DI)
export const scheduleStore = createScheduleStore(mockScheduleDeps);
export const messageStore = createMessageStore(mockMessageDeps);
export const checkInStore = createCheckInStore(mockCheckInDeps);
export const authStore = createAuthStore(mockAuthDeps);
export const settingsStore = createSettingsStore(mockSettingsDeps);
export const connectionStore = createConnectionStore({
  network: mockNetworkService,
  onOnline: () => {
    void messageStore.getState().sync();
  },
});

// TEMP: mock deps until #32 (DI)
// Event and transit data, not user data: left out of resetOnLogout on purpose.
export const lineupStore = createLineupStore(mockLineupDeps);
export const transitStore = createTransitStore(mockTransitDeps);

// App-lifetime subscription: logout clears the user-scoped stores.
resetOnLogout(authStore, [scheduleStore, messageStore, checkInStore, settingsStore]);

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
