import { useStore } from "zustand";

import {
  mockAuthDeps,
  mockCheckInDeps,
  mockMessageDeps,
  mockNetworkService,
  mockScheduleDeps,
} from "@/mocks/mockStoreDeps";

import { type AuthState, createAuthStore } from "./authStore";
import { type CheckInState, createCheckInStore } from "./checkInStore";
import { type ConnectionState, createConnectionStore } from "./connectionStore";
import { createMessageStore, type MessageState } from "./messageStore";
import { resetOnLogout } from "./resetOnLogout";
import { createScheduleStore, type ScheduleState } from "./scheduleStore";

// TEMP: mock deps until #32 (DI)
export const scheduleStore = createScheduleStore(mockScheduleDeps);
export const messageStore = createMessageStore(mockMessageDeps);
export const checkInStore = createCheckInStore(mockCheckInDeps);
export const authStore = createAuthStore(mockAuthDeps);
export const connectionStore = createConnectionStore({
  network: mockNetworkService,
  onOnline: () => {
    void messageStore.getState().sync();
  },
});

// App-lifetime subscription: logout clears the user-scoped stores.
resetOnLogout(authStore, [scheduleStore, messageStore, checkInStore]);

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

export { selectIsSignedIn } from "./authStore";
export type { AuthError, SessionUser } from "./authStore";
export { selectIsCheckedIn, selectIsCheckInPending } from "./checkInStore";
export type { CheckInError } from "./checkInStore";
export { toConnectionBarState } from "./connectionStore";
export {
  selectDeliveryState,
  selectIsMessagePending,
  selectQueuedCount,
} from "./messageStore";
export type { MessageError } from "./messageStore";
export { selectIsPlanned, selectIsSchedulePending } from "./scheduleStore";
export type { ScheduleError } from "./scheduleStore";
