import { useEffect } from "react";

import { formatTime } from "@/components/mappers";
import {
  connectionStore,
  selectHasLineup,
  selectQueuedCount,
  toConnectionBarState,
  useConnectionStore,
  useLineupStore,
  useMessageStore,
} from "@/store";
import { strings } from "@/strings";
import type { ConnectionBarProps } from "@/types/components";

import { useSession } from "./useSession";

/**
 * Starts the network subscription once for the app lifetime (A12 in #71).
 * Called from the root layout; the cleanup stops it.
 */
export function useConnectionMonitor(): void {
  useEffect(() => connectionStore.getState().start(), []);
}

/**
 * Reads the festival line-up once the tabs mount: Plan shows it and the
 * ConnectionBar needs to know whether any data is on the phone, whichever
 * tab opens first.
 */
export function useLineupLoader(): void {
  const { eventId } = useSession();
  const load = useLineupStore((state) => state.load);
  useEffect(() => {
    void load(eventId);
  }, [load, eventId]);
}

/** C03 props for the bar above the tab bar. */
export function useConnectionBar(): Omit<ConnectionBarProps, "testID"> {
  const online = useConnectionStore((state) => state.online);
  const syncing = useMessageStore((state) => state.syncing);
  // Queued + stale; the count does not depend on the clock, so no `now` tick here.
  const queued = useMessageStore((state) => selectQueuedCount(state));
  const hasData = useLineupStore(selectHasLineup);
  const downloadedAt = useLineupStore((state) => state.event?.downloadedAt ?? null);

  const state = toConnectionBarState({ online, syncing, hasData });
  const time = downloadedAt === null ? null : formatTime(downloadedAt);

  let detail: string;
  if (state === "noData" || time === null) detail = strings.connection.noData;
  else if (state === "offline") detail = strings.connection.dataFrom(time);
  else detail = strings.connection.syncedAt(time);

  return { state, detail, queued };
}
