import { useEffect } from "react";

import { settingsStore } from "@/store";

import { useSession } from "./useSession";

/**
 * Loads the S10 settings of the current user once per user. Until the load
 * finishes (and with no saved row) the defaults apply.
 */
export function useSettingsLoader(): void {
  const { userId } = useSession();
  useEffect(() => {
    void settingsStore.getState().load(userId);
  }, [userId]);
}
