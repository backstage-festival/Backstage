import { router } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { FALLBACK_STAGE_ID, formatTime } from "@/components/mappers";
import { stageNumber } from "@/components/PerformanceCard";
import type { Stage } from "@/domain/entities/Event";
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

const errorNote = (concertId: string | null, label: string, accessibilityLabel: string = label): PlanNote => ({
  concertId,
  label,
  accessibilityLabel,
  tone: "error",
  allowConflict: false,
});

/**
 * Store error → note under the card (null = nothing to show). A conflict uses
 * the card format „Kolizja · S2 od 02:00”; the artist goes to TalkBack only.
 */
export function toPlanNote(error: ScheduleError | null, stages: readonly Stage[]): PlanNote | null {
  if (error === null) return null;
  switch (error.kind) {
    case "conflict": {
      const other = error.conflicts[0];
      if (other === undefined) {
        return { ...errorNote(error.concertId, strings.status.conflict), tone: "warning", allowConflict: true };
      }
      const n = stageNumber(stageCodesOf(stages)[other.stageId] ?? FALLBACK_STAGE_ID);
      const stageName = stages.find((stage) => stage.id === other.stageId)?.name ?? "";
      const time = formatTime(other.startsAt);
      return {
        concertId: error.concertId,
        label: strings.plan.conflictLine(n, time),
        accessibilityLabel: strings.planScreen.note.conflictA11y(other.artist, n, stageName, time),
        tone: "warning",
        allowConflict: true,
      };
    }
    case "saveFailed":
      return errorNote(error.concertId, strings.planScreen.note.saveFailed, strings.planScreen.note.saveFailedA11y);
    case "removeFailed":
      return errorNote(error.concertId, strings.planScreen.note.removeFailed, strings.planScreen.note.removeFailedA11y);
    case "concertNotFound":
      return errorNote(
        error.concertId,
        strings.planScreen.note.concertNotFound,
        strings.planScreen.note.concertNotFoundA11y,
      );
    case "loadFailed":
      return errorNote(null, strings.planScreen.note.loadFailed, strings.planScreen.note.loadFailedA11y);
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
  const note = useMemo(() => toPlanNote(lastError, stages), [lastError, stages]);

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
