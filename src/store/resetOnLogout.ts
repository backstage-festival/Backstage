import type { Unsubscribe } from "@/domain/entities/common";

import type { AuthStore } from "./authStore";

export interface Resettable {
  getState(): { reset(): void };
}

/**
 * Resets the user-scoped stores when the session ends (user: object → null),
 * so the next user never sees the previous user's plan, messages or check-ins.
 */
export function resetOnLogout(
  authStore: AuthStore,
  stores: readonly Resettable[],
): Unsubscribe {
  return authStore.subscribe((state, previous) => {
    if (previous.user !== null && state.user === null) {
      for (const store of stores) store.getState().reset();
    }
  });
}
