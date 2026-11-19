import { createStore } from "zustand/vanilla";

import type { IsoDateString, Unsubscribe } from "@/domain/entities/common";
import type { INetworkService } from "@/domain/repositories/INetworkService";
import type { ConnectionBarState } from "@/types/components";

export interface ConnectionStoreDeps {
  readonly network: INetworkService;
  /** Called on every offline → online transition (e.g. sync the outbox). */
  readonly onOnline?: () => void;
}

export interface ConnectionState {
  /** null = not known yet (before the first isOnline() answer). */
  readonly online: boolean | null;
  readonly lastOnlineAt: IsoDateString | null;

  /** Idempotent: a second call returns the same subscription. */
  start(): Unsubscribe;
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>;

export function createConnectionStore(deps: ConnectionStoreDeps) {
  let stop: Unsubscribe | null = null;

  return createStore<ConnectionState>()((set, get) => {
    const apply = (online: boolean): void => {
      const previous = get().online;
      set(
        online
          ? { online, lastOnlineAt: new Date().toISOString() }
          : { online },
      );
      if (previous === false && online) deps.onOnline?.();
    };

    return {
      online: null,
      lastOnlineAt: null,

      start() {
        if (stop !== null) return stop;

        let active = true;
        // An onChange event is newer than the initial isOnline() answer.
        let changedBeforeInitial = false;

        const unsubscribe = deps.network.onChange((online) => {
          if (!active) return;
          changedBeforeInitial = true;
          apply(online);
        });

        deps.network.isOnline().then(
          (online) => {
            if (active && !changedBeforeInitial) apply(online);
          },
          () => {
            // Unknown state stays null; onChange will report the next change.
          },
        );

        const current: Unsubscribe = () => {
          if (!active) return;
          active = false;
          unsubscribe();
          if (stop === current) stop = null;
        };
        stop = current;
        return current;
      },
    };
  });
}

export interface ConnectionBarInput {
  readonly online: boolean | null;
  readonly syncing: boolean;
  /** Whether any festival data is stored locally. */
  readonly hasData: boolean;
}

/**
 * Priority: syncing (only while online) → noData → offline → online.
 * An unknown connection (null) is shown as "online" so the bar does not
 * flash "offline" on app start.
 */
export function toConnectionBarState({
  online,
  syncing,
  hasData,
}: ConnectionBarInput): ConnectionBarState {
  if (online !== false && syncing) return "syncing";
  if (!hasData) return "noData";
  if (online === false) return "offline";
  return "online";
}
