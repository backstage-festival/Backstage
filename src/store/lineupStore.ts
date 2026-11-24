import { createStore } from "zustand/vanilla";

import type { Concert, FestivalEvent, Stage } from "@/domain/entities/Event";

import type { LoadStatus } from "./optimistic";

/** What the Plan needs from the downloaded event package. */
export interface Lineup {
  readonly event: FestivalEvent | null;
  readonly stages: readonly Stage[];
  readonly concerts: readonly Concert[];
}

export interface LineupStoreDeps {
  // TODO(#22/#32): provided by DI (read use case for the event package)
  readonly loadLineup: (eventId: string) => Promise<Lineup>;
}

export type LineupError = { readonly kind: "loadFailed" };

export interface LineupData extends Lineup {
  readonly eventId: string | null;
  readonly loadStatus: LoadStatus;
  readonly lastError: LineupError | null;
}

export interface LineupState extends LineupData {
  /** Reads the line-up from the phone. Data of the same event stays visible meanwhile. */
  load(eventId: string): Promise<boolean>;
  /** Back to the initial state; late responses of earlier calls are dropped. */
  reset(): void;
}

export type LineupStore = ReturnType<typeof createLineupStore>;

const initialLineupData = (): LineupData => ({
  eventId: null,
  event: null,
  stages: [],
  concerts: [],
  loadStatus: "idle",
  lastError: null,
});

/**
 * Read-only line-up of the current festival (concerts and stages). It does
 * not depend on the signed-in user, so it is not reset on logout.
 */
export function createLineupStore(deps: LineupStoreDeps) {
  // Guards against an older load() overwriting a newer one.
  let loadToken = 0;

  return createStore<LineupState>()((set, get) => ({
    ...initialLineupData(),

    async load(eventId) {
      const token = ++loadToken;
      if (get().eventId !== eventId) {
        set({ ...initialLineupData(), eventId });
      }
      set({ loadStatus: "loading", lastError: null });
      try {
        const lineup = await deps.loadLineup(eventId);
        if (token !== loadToken) return false;
        set({
          event: lineup.event,
          stages: lineup.stages,
          concerts: lineup.concerts,
          loadStatus: "ready",
        });
        return true;
      } catch {
        if (token !== loadToken) return false;
        // Cached data of the same event stays on screen.
        set({ loadStatus: "error", lastError: { kind: "loadFailed" } });
        return false;
      }
    },

    reset() {
      loadToken += 1;
      set(initialLineupData());
    },
  }));
}

export const selectHasLineup = (state: Pick<LineupState, "concerts">): boolean =>
  state.concerts.length > 0;
