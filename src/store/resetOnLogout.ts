import type { Unsubscribe } from "@/domain/entities/common";

import type { AuthStore } from "./authStore";

export interface Resettable {
  getState(): { reset(): void };
}

/**
 * Resets the user-scoped stores when the session ends (user: object → null)
 * or another user signs in without logging out first (user.id A → B),
 * so the next user never sees the previous user's plan, messages or check-ins.
 * Signing in from null, signing in again as the same user and failed
 * attempts leave the stores alone.
 */
export function resetOnLogout(
  authStore: AuthStore,
  stores: readonly Resettable[],
): Unsubscribe {
  return authStore.subscribe((state, previous) => {
    if (previous.user === null) return;
    if (state.user === null || state.user.id !== previous.user.id) {
      for (const store of stores) store.getState().reset();
    }
  });
}
