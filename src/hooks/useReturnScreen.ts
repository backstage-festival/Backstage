import { router } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { formatTime } from "@/components/mappers";
import type { NoteCardProps } from "@/components/NoteCard";
import {
  selectDepartureState,
  selectTransitFreshness,
  selectUpcomingDepartures,
  type TransitError,
  useTransitStore,
} from "@/store";
import { strings } from "@/strings";

import { ageParts, buildReturnRows, type ReturnRow } from "./returnRows";
import { useNow } from "./useNow";

export type ReturnStatus = "loading" | "error" | "noData" | "nothingLeft" | "ready";

export interface ReturnScreen {
  readonly status: ReturnStatus;
  readonly error: TransitError | null;
  readonly rows: readonly ReturnRow[];
  /** „Dane z 21:40”, null when nothing was loaded. */
  readonly asOfLabel: string | null;
  /** Older than the domain TTL for departures → timetable view (E08-Nieaktualne). */
  readonly isStale: boolean;
  readonly staleNote: NoteCardProps | null;
  readonly alertNote: NoteCardProps | null;
  readonly guide: () => void;
  readonly reload: () => void;
}

/** The only place the Powrót screen reads stores. */
export function useReturnScreen(): ReturnScreen {
  const now = useNow();
  const { stops, departures, alerts, asOf, loadStatus, lastError } = useTransitStore(
    useShallow((state) => ({
      stops: state.stops,
      departures: state.departures,
      alerts: state.alerts,
      asOf: state.asOf,
      loadStatus: state.loadStatus,
      lastError: state.lastError,
    })),
  );
  const load = useTransitStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const freshness = selectTransitFreshness({ asOf }, now);
  const isStale = freshness !== null && !freshness.isValid;

  const rows = useMemo(
    () =>
      buildReturnRows({
        stops,
        departures,
        now,
        timetableOnly: isStale,
        upcoming: selectUpcomingDepartures,
        stateOf: selectDepartureState,
      }),
    [stops, departures, now, isStale],
  );

  const asOfTime = asOf === null ? null : formatTime(asOf);

  const staleNote = useMemo(() => {
    if (!isStale || freshness === null || asOfTime === null) return null;
    const { hours, minutes } = ageParts(freshness.ageMs);
    return {
      title: strings.returnScreen.staleTitle(asOfTime, strings.returnScreen.age(hours, minutes)),
      body: strings.returnScreen.staleBody(asOfTime),
    };
  }, [isStale, freshness, asOfTime]);

  // One warning note from the first alert; expanding the list is out of scope.
  const first = alerts[0];
  const alertNote = useMemo(
    () => (first ? { title: strings.returnScreen.alertTitle(first.title), body: first.body } : null),
    [first],
  );

  // TODO(#35): guide to the tapped stop; the map opens without a route for now.
  const guide = useCallback(() => {
    router.navigate("/map");
  }, []);
  const reload = useCallback(() => {
    void load();
  }, [load]);

  let status: ReturnStatus = "ready";
  if (stops.length === 0) {
    if (loadStatus === "idle" || loadStatus === "loading") status = "loading";
    else if (loadStatus === "error") status = "error";
    else status = "noData";
  } else if (rows.length === 0) {
    status = Object.keys(departures).length === 0 ? "noData" : "nothingLeft";
  }

  return {
    status,
    error: lastError,
    rows,
    asOfLabel: asOfTime === null ? null : strings.returnScreen.dataFrom(asOfTime),
    isStale,
    staleNote,
    alertNote,
    guide,
    reload,
  };
}
