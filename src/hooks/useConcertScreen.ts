import { router } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { Linking } from "react-native";

import { CHECK_IN_RADIUS_METERS } from "@/domain/utils/geofence";
import { stageIdOf } from "@/components/mappers";
import { stageNumber } from "@/components/PerformanceCard";
import { mockBearing } from "@/mocks/bearing";
import {
  checkInStore,
  lineupStore,
  scheduleStore,
  selectIsCheckedIn,
  selectIsPlanned,
  selectIsSchedulePending,
  useCheckInStore,
  useLineupStore,
  useScheduleStore,
} from "@/store";
import type { CheckInState } from "@/store/checkInStore";
import type { ScheduleState } from "@/store/scheduleStore";
import { strings } from "@/strings";
import type { CheckInRangeProps, ConcertPassProps, DistanceGaugeProps } from "@/types/components";

import {
  type CheckInNote,
  type CheckInStatus,
  checkInDisabledReason,
  checkInErrorNote,
  checkInStatusOf,
  checkInWindowOf,
  type ConflictTag,
  conflictTagOf,
  distanceToStage,
  gaugeA11yLabel,
  gaugeAnnounceState,
  gaugeStateOf,
  toCheckInRangeProps,
  toConcertPassProps,
} from "./concertCard";
import { passSerial, stageCodesOf } from "./planRows";
import { toPlanNote } from "./usePlanScreen";
import { type BearingFn, formatDistance, relativeAngle, spokenDistance, walkMinutes } from "./tentRows";
import { useHeading, usePosition } from "./useLocation";
import { useNow } from "./useNow";
import { useSession } from "./useSession";
import { useThrottledA11yLabel } from "./useThrottledA11yLabel";

// TODO: replace with bearingCalculator from feature/compass-network-service (as usePlaceGuide).
const bearing: BearingFn = mockBearing;

const t = strings.concert;

export interface PlanToggle {
  readonly inPlan: boolean;
  readonly pending: boolean;
  /** Schedule write failed for this concert (store rollback). */
  readonly note: { readonly label: string; readonly accessibilityLabel: string } | null;
  readonly toggle: () => void;
}

export interface CheckInBlock {
  readonly status: CheckInStatus;
  /** Visible reason under the disabled button (closed / no GPS). */
  readonly disabledReason: string | null;
  /** TalkBack hint: what the button does, or why it is disabled. */
  readonly hint: string;
  readonly range: CheckInRangeProps | null;
  readonly error: CheckInNote | null;
  readonly checkIn: () => void;
}

export type ConcertScreen =
  | { readonly status: "loading" }
  | { readonly status: "notFound" }
  | {
      readonly status: "ready";
      readonly pass: ConcertPassProps;
      readonly conflict: ConflictTag | null;
      readonly gauge: Omit<DistanceGaugeProps, "testID">;
      readonly plan: PlanToggle;
      readonly checkIn: CheckInBlock;
      /** E05b shortens the explanation when the range bar is on screen. */
      readonly explainShort: boolean;
    };

/** Selector for a missing route param – nothing to look up. */
const never = (): false => false;

const openSettings = (): void => {
  void Linking.openSettings();
};

// TODO(#35): route to stage – the map (Przemek) will draw the way to the stage.
const guideToStage = (): void => {
  router.push("/map");
};

/** Reads the line-up, the plan and the check-ins once if no other screen has (deep link). */
function useConcertData(userId: string, eventId: string): void {
  useEffect(() => {
    if (lineupStore.getState().loadStatus === "idle") void lineupStore.getState().load(eventId);
  }, [eventId]);
  useEffect(() => {
    const schedule = scheduleStore.getState();
    if (schedule.loadStatus === "idle" || schedule.userId !== userId) void schedule.load(userId, eventId);
  }, [userId, eventId]);
  useEffect(() => {
    if (checkInStore.getState().loadStatus === "idle") void checkInStore.getState().load(userId);
  }, [userId]);
  // A check-in error belongs to this card: gone when the modal closes.
  useEffect(() => () => checkInStore.getState().clearError(), []);
}

/** The only place S05 reads stores and sensors. */
export function useConcertScreen(concertId: string | null): ConcertScreen {
  const { userId, eventId } = useSession();
  useConcertData(userId, eventId);
  const now = useNow();

  const concerts = useLineupStore((state) => state.concerts);
  const stages = useLineupStore((state) => state.stages);
  const loadStatus = useLineupStore((state) => state.loadStatus);
  const plannedIds = useScheduleStore((state) => state.plannedIds);
  const scheduleError = useScheduleStore((state) => state.lastError);
  const inPlan = useScheduleStore(
    useMemo<(state: ScheduleState) => boolean>(() => (concertId === null ? never : selectIsPlanned(concertId)), [concertId]),
  );
  const planPending = useScheduleStore(
    useMemo<(state: ScheduleState) => boolean>(
      () => (concertId === null ? never : selectIsSchedulePending(concertId)),
      [concertId],
    ),
  );
  const checkedIn = useCheckInStore(
    useMemo<(state: CheckInState) => boolean>(() => (concertId === null ? never : selectIsCheckedIn(concertId)), [concertId]),
  );
  const checkInError = useCheckInStore((state) => state.lastError);
  const { position, permission, retry } = usePosition();
  const { heading } = useHeading();

  const concert = useMemo(
    () => (concertId === null ? undefined : concerts.find((c) => c.id === concertId)),
    [concerts, concertId],
  );
  const stage = useMemo(
    () => (concert === undefined ? undefined : stages.find((s) => s.id === concert.stageId)),
    [stages, concert],
  );
  const stageCodes = useMemo(() => stageCodesOf(stages), [stages]);

  const pass = useMemo(
    // Same function and line-up as the Plan's NowPass (buildPlanView), so both show one number.
    () =>
      concert && stage
        ? toConcertPassProps(
            concert,
            stage,
            stageCodes,
            passSerial(concert, stageNumber(stageIdOf(stage, stageCodes)), concerts),
            now,
          )
        : null,
    [concert, stage, stageCodes, concerts, now],
  );
  const conflict = useMemo(() => {
    if (concert === undefined) return null;
    const planned = concerts.filter((c) => plannedIds.has(c.id));
    return conflictTagOf(concert, inPlan, planned, stages, stageCodes);
  }, [concert, concerts, plannedIds, inPlan, stages, stageCodes]);

  const distanceM = stage === undefined ? null : distanceToStage(position, stage.location);
  const gaugeState = gaugeStateOf(permission, distanceM);
  const arrow =
    stage === undefined || position === null
      ? null
      : heading === null
        ? bearing(position, stage.location)
        : relativeAngle(bearing(position, stage.location), heading);

  // Hooks run on every render, so the throttle gets neutral values before the concert is known.
  const announced = useThrottledA11yLabel(
    stage === undefined ? "" : gaugeA11yLabel(gaugeState, distanceM),
    gaugeAnnounceState(gaugeState),
    0,
    distanceM !== null,
  );

  const status = useMemo(
    () =>
      concert && stage
        ? checkInStatusOf({
            checkedIn,
            window: checkInWindowOf(concert, now),
            permission,
            position,
            stageLocation: stage.location,
          })
        : null,
    [concert, stage, checkedIn, now, permission, position],
  );

  const conflictVisible = conflict !== null;
  const togglePlan = useCallback(() => {
    if (concertId === null) return;
    const schedule = scheduleStore.getState();
    if (schedule.pendingIds.has(concertId)) return;
    if (schedule.plannedIds.has(concertId)) void schedule.remove(concertId);
    // The user sees the conflict on the card, so adding means „add anyway”.
    else void schedule.add(concertId, conflictVisible ? { allowConflict: true } : undefined);
  }, [concertId, conflictVisible]);

  const checkIn = useCallback(() => {
    if (concertId === null) return;
    const store = checkInStore.getState();
    store.clearError();
    void store.checkIn(userId, eventId, concertId);
  }, [concertId, userId, eventId]);

  const planNote = useMemo(() => {
    if (concertId === null || scheduleError === null) return null;
    if (scheduleError.kind === "loadFailed" || scheduleError.kind === "notLoaded") return null;
    if (scheduleError.concertId !== concertId) return null;
    return toPlanNote(scheduleError, stages);
  }, [scheduleError, concertId, stages]);

  if (concertId === null) return { status: "notFound" };
  if (concert === undefined || stage === undefined || pass === null || status === null) {
    return loadStatus === "idle" || loadStatus === "loading" ? { status: "loading" } : { status: "notFound" };
  }

  const distanceText = distanceM === null ? strings.tent.noDistance : formatDistance(distanceM);
  let hint: string = t.a11y.checkInHint;
  if (status.kind === "tooFar") hint = t.a11y.tooFarHint(spokenDistance(status.distanceM), CHECK_IN_RADIUS_METERS);
  const reason = checkInDisabledReason(status);
  if (reason !== null) hint = reason;

  return {
    status: "ready",
    pass,
    conflict,
    gauge: {
      state: gaugeState,
      bearingDeg: arrow,
      distance: distanceText,
      walk: distanceM === null ? null : t.walk(walkMinutes(distanceM)),
      accessibilityLabel: announced,
      onGuide: guideToStage,
      onRetry: retry,
      onOpenSettings: openSettings,
    },
    plan: {
      inPlan,
      pending: planPending,
      note: planNote === null ? null : { label: planNote.label, accessibilityLabel: planNote.accessibilityLabel },
      toggle: togglePlan,
    },
    checkIn: {
      status,
      disabledReason: reason,
      hint,
      range: status.kind === "tooFar" ? toCheckInRangeProps(status.distanceM) : null,
      error: checkInErrorNote(checkInError, concertId),
      checkIn,
    },
    explainShort: status.kind === "tooFar",
  };
}
