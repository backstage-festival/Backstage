import { createStore } from "zustand/vanilla";

import type { IsoDateString } from "@/domain/entities/common";
import type { Departure, TransitAlert } from "@/domain/entities/Transit";
import { DomainError } from "@/domain/errors/DomainError";
import { type CacheFreshness, getCacheFreshness } from "@/domain/utils/cacheValidity";
import type { GetNearbyStopsUseCase, NearbyStop } from "@/use-cases/GetNearbyStopsUseCase";
import type { DepartureState } from "@/types/components";

import type { LoadStatus } from "./optimistic";

export interface TransitStoreDeps {
  readonly getNearbyStops: Pick<GetNearbyStopsUseCase, "execute">;
  // TODO(#22/#32): provided by DI
  readonly loadDepartures: (stopIds: readonly number[]) => Promise<readonly Departure[]>;
  // TODO(#22/#32): provided by DI
  readonly loadAlerts: () => Promise<readonly TransitAlert[]>;
}

export type TransitError = { readonly kind: "locationUnavailable" } | { readonly kind: "loadFailed" };

export interface TransitData {
  /** Nearest stops first, with the walking distance. */
  readonly stops: readonly NearbyStop[];
  /** Departures by stop id, earliest first. */
  readonly departures: Readonly<Record<number, readonly Departure[]>>;
  readonly alerts: readonly TransitAlert[];
  /** Oldest fetchedAt of the departures – the age of what is on screen. */
  readonly asOf: IsoDateString | null;
  readonly loadStatus: LoadStatus;
  readonly lastError: TransitError | null;
}

export interface TransitState extends TransitData {
  /** Reads nearby stops, their departures and alerts. Old data stays visible meanwhile. */
  load(): Promise<boolean>;
  /** Back to the initial state; late responses of earlier calls are dropped. */
  reset(): void;
}

export type TransitStore = ReturnType<typeof createTransitStore>;

const initialTransitData = (): TransitData => ({
  stops: [],
  departures: {},
  alerts: [],
  asOf: null,
  loadStatus: "idle",
  lastError: null,
});

const toTransitError = (error: unknown): TransitError =>
  error instanceof DomainError && error.code === "LOCATION_UNAVAILABLE"
    ? { kind: "locationUnavailable" }
    : { kind: "loadFailed" };

/** Planned departure + delay (null delay = timetable only). */
export function departsAtMs(departure: Departure, timetableOnly = false): number {
  const delay = timetableOnly ? 0 : (departure.delaySeconds ?? 0);
  return Date.parse(departure.departureAt) + delay * 1000;
}

function groupByStop(departures: readonly Departure[]): Record<number, readonly Departure[]> {
  const grouped: Record<number, Departure[]> = {};
  for (const departure of departures) {
    (grouped[departure.stopId] ??= []).push(departure);
  }
  for (const list of Object.values(grouped)) list.sort((a, b) => departsAtMs(a) - departsAtMs(b));
  return grouped;
}

function oldestFetchedAt(departures: readonly Departure[]): IsoDateString | null {
  let oldest: IsoDateString | null = null;
  let oldestMs = Number.POSITIVE_INFINITY;
  for (const departure of departures) {
    const ms = Date.parse(departure.fetchedAt);
    if (!Number.isNaN(ms) && ms < oldestMs) {
      oldestMs = ms;
      oldest = departure.fetchedAt;
    }
  }
  return oldest;
}

/**
 * Read-only transit data for Powrót: nearby stops, departures, alerts. It
 * does not depend on the signed-in user, so it is not reset on logout.
 */
export function createTransitStore(deps: TransitStoreDeps) {
  // Guards against an older load() overwriting a newer one.
  let loadToken = 0;

  return createStore<TransitState>()((set) => ({
    ...initialTransitData(),

    async load() {
      const token = ++loadToken;
      set({ loadStatus: "loading", lastError: null });
      try {
        const stops = await deps.getNearbyStops.execute();
        const [departures, alerts] = await Promise.all([
          deps.loadDepartures(stops.map((stop) => stop.id)),
          deps.loadAlerts(),
        ]);
        if (token !== loadToken) return false;
        set({
          stops,
          departures: groupByStop(departures),
          alerts,
          asOf: oldestFetchedAt(departures),
          loadStatus: "ready",
        });
        return true;
      } catch (error) {
        if (token !== loadToken) return false;
        // Cached stops and departures stay on screen.
        set({ loadStatus: "error", lastError: toTransitError(error) });
        return false;
      }
    },

    reset() {
      loadToken += 1;
      set(initialTransitData());
    },
  }));
}

/* ------------------------------------------------------------------ */
/* Selectors – pure, never throw while rendering; `now` from the screen */
/* ------------------------------------------------------------------ */

const MINUTE_MS = 60_000;
/** C05: leave within the next minute → „Wyjdź teraz”. */
export const LEAVE_NOW_WINDOW_MS = MINUTE_MS;
/** C05: leave within 15 minutes → „Wyjdź o HH:MM”. */
export const LEAVE_AT_WINDOW_MS = 15 * MINUTE_MS;

/** Age of the data on screen (domain TTL for departures), or null when unknown. */
export function selectTransitFreshness(
  state: Pick<TransitState, "asOf">,
  now: Date = new Date(),
): CacheFreshness | null {
  if (state.asOf === null) return null;
  try {
    return getCacheFreshness(state.asOf, "departures", now);
  } catch (error) {
    if (error instanceof DomainError) return null;
    throw error;
  }
}

/**
 * When to leave for a departure, given the walk to its stop. „missed” =
 * walking now you would not make it; the row stays until the vehicle leaves.
 */
export function selectDepartureState(
  departure: Departure,
  walkSeconds: number,
  now: Date = new Date(),
  timetableOnly = false,
): DepartureState {
  const untilLeave = departsAtMs(departure, timetableOnly) - walkSeconds * 1000 - now.getTime();
  if (untilLeave < 0) return "missed";
  if (untilLeave <= LEAVE_NOW_WINDOW_MS) return "leaveNow";
  if (untilLeave <= LEAVE_AT_WINDOW_MS) return "leaveAt";
  return "later";
}

/** Departures that have not left yet (an invalid date is dropped, never thrown). */
export function selectUpcomingDepartures(
  departures: readonly Departure[],
  now: Date = new Date(),
  timetableOnly = false,
): readonly Departure[] {
  const nowMs = now.getTime();
  return departures.filter((departure) => departsAtMs(departure, timetableOnly) >= nowMs);
}
