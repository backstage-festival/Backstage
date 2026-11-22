import { router } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { formatTime } from "@/components/mappers";
import { stageNumber } from "@/components/PerformanceCard";
import { mockPassSerial } from "@/mocks/mockData";
import { scheduleStore, type ScheduleError, useLineupStore, useScheduleStore } from "@/store";
import { strings } from "@/strings";
import type { SegmentedOption, StageId } from "@/types/components";

import {
  buildPlanView,
  dayLabel,
  festivalDayOf,
  festivalDays,
  nowLabel,
  type PlanFilters,
  type PlanNote,
  type PlanView,
  stageCodesOf,
} from "./planRows";
import { type LeaveNowAlertData, useLeaveNowAlert } from "./useLeaveNowAlert";
import { useNow } from "./useNow";
import { useSession } from "./useSession";

export type PlanStatus = "loading" | "noLineup" | "ready";

export interface PlanScreen extends PlanView {
  readonly status: PlanStatus;
  /** „Pt 2.07 · 20:03” */
  readonly eyebrow: string;
  readonly nowHeader: string;
  readonly alert: LeaveNowAlertData | null;
  readonly dayOptions: readonly SegmentedOption<string>[];
  readonly stageOptions: readonly SegmentedOption<StageId>[];
  readonly togglePlan: (concertId: string) => void;
  readonly addAnyway: (concertId: string) => void;
  readonly dismissNote: () => void;
  readonly openConcert: (concertId: string) => void;
}

/** Store error → note under the card (null = nothing to show). */
export function toPlanNote(error: ScheduleError | null): PlanNote | null {
  if (error === null) return null;
  switch (error.kind) {
    case "conflict":
      return {
        concertId: error.concertId,
        label: strings.planScreen.note.conflict(error.conflicts[0]?.artist ?? ""),
        tone: "warning",
        allowConflict: true,
      };
    case "saveFailed":
      return { concertId: error.concertId, label: strings.planScreen.note.saveFailed, tone: "error", allowConflict: false };
    case "removeFailed":
      return { concertId: error.concertId, label: strings.planScreen.note.removeFailed, tone: "error", allowConflict: false };
    case "concertNotFound":
      return { concertId: error.concertId, label: strings.planScreen.note.concertNotFound, tone: "error", allowConflict: false };
    case "loadFailed":
      return { concertId: null, label: strings.planScreen.note.loadFailed, tone: "error", allowConflict: false };
    case "notLoaded":
      // Transient: a tap before the plan loaded.
      return null;
  }
}

/**
 * The only place the Plan screen reads stores. Filters are the screen's own
 * state; everything else comes ready for the components.
 */
export function usePlanScreen(filters: PlanFilters, playedExpanded: boolean): PlanScreen {
  const { userId, eventId } = useSession();
  const now = useNow();

  const { event, stages, concerts, loadStatus } = useLineupStore(
    useShallow((state) => ({
      event: state.event,
      stages: state.stages,
      concerts: state.concerts,
      loadStatus: state.loadStatus,
    })),
  );
  const plannedIds = useScheduleStore((state) => state.plannedIds);
  const lastError = useScheduleStore((state) => state.lastError);
  const loadSchedule = useScheduleStore((state) => state.load);
  const add = useScheduleStore((state) => state.add);
  const remove = useScheduleStore((state) => state.remove);
  const clearError = useScheduleStore((state) => state.clearError);

  useEffect(() => {
    void loadSchedule(userId, eventId);
  }, [loadSchedule, userId, eventId]);

  const alert = useLeaveNowAlert(now);
  const accentSuppressed = alert !== null;
  const days = useMemo(() => festivalDays(event, concerts), [event, concerts]);
  const note = useMemo(() => toPlanNote(lastError), [lastError]);

  const view = useMemo(
    () =>
      buildPlanView({
        concerts,
        stages,
        plannedIds,
        days,
        filters,
        now,
        playedExpanded,
        note,
        serial: mockPassSerial, // TEMP: the pass serial is not in the domain yet
        accentSuppressed,
      }),
    [concerts, stages, plannedIds, days, filters, now, playedExpanded, note, accentSuppressed],
  );

  const dayOptions = useMemo(() => days.map((day) => ({ value: day, label: dayLabel(day) })), [days]);
  const stageOptions = useMemo(() => {
    const codes = stageCodesOf(stages);
    return stages.flatMap((stage) => {
      const code = codes[stage.id];
      if (code === undefined) return [];
      const n = stageNumber(code);
      return [{ value: code, label: strings.plan.stageCode(n), accessibilityLabel: strings.planScreen.a11y.stage(n, stage.name) }];
    });
  }, [stages]);

  // Read the store at tap time, so the callbacks stay stable for memoized rows.
  const togglePlan = useCallback(
    (concertId: string) => {
      if (scheduleStore.getState().plannedIds.has(concertId)) void remove(concertId);
      else void add(concertId);
    },
    [add, remove],
  );
  const addAnyway = useCallback(
    (concertId: string) => {
      void add(concertId, { allowConflict: true });
    },
    [add],
  );
  const openConcert = useCallback((concertId: string) => {
    router.push({ pathname: "/performance/[id]", params: { id: concertId } });
  }, []);

  let status: PlanStatus = "ready";
  if (concerts.length === 0) status = loadStatus === "idle" || loadStatus === "loading" ? "loading" : "noLineup";

  return {
    ...view,
    status,
    eyebrow: strings.planScreen.eyebrow(dayLabel(festivalDayOf(now)), formatTime(now)),
    nowHeader: nowLabel(now),
    alert,
    dayOptions,
    stageOptions,
    togglePlan,
    addAnyway,
    dismissNote: clearError,
    openConcert,
  };
}
