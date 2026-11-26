/**
 * Pure view logic for S05 · Karta koncertu (modal). No React, no stores –
 * useConcertScreen feeds it. Distance and the check-in rule come from the
 * domain (checkGeofence, CHECK_IN_RADIUS_METERS, isCheckInOpen).
 */
import { formatTime, type StageCodes, stageIdOf, toNowPassProps } from "@/components/mappers";
import { stageNumber } from "@/components/PerformanceCard";
import type { Coordinates } from "@/domain/entities/common";
import type { Concert, Stage } from "@/domain/entities/Event";
import { DomainError } from "@/domain/errors/DomainError";
import { CHECK_IN_OPENS_BEFORE_MS, isCheckInOpen } from "@/domain/utils/checkInWindow";
import { CHECK_IN_RADIUS_METERS, checkGeofence } from "@/domain/utils/geofence";
import type { CheckInError } from "@/store";
import { strings } from "@/strings";
import type { CheckInRangeProps, CompassState, ConcertPassProps, DistanceGaugeState } from "@/types/components";

import { dayLabel, festivalDayOf, firstConflict } from "./planRows";
import { formatDistance, spokenDistance } from "./tentRows";
import type { LocationPermission } from "./useLocation";

const t = strings.concert;
const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;

/**
 * ASSUMPTION (not on S05): the CheckInRange bar spans 0–500 m, so the 50 m
 * zone is a tenth of it (E05b) and anything farther pins „Ty” to the end.
 */
export const CHECK_IN_RANGE_SCALE_M = 500;

/* ------------------------------------------------------------------ */
/* Time                                                                 */
/* ------------------------------------------------------------------ */

export type ConcertTiming =
  | { readonly kind: "upcoming"; readonly startsInMin: number }
  | { readonly kind: "now" }
  | { readonly kind: "played" };

export function concertTiming(concert: Pick<Concert, "startsAt" | "endsAt">, now: Date): ConcertTiming {
  const nowMs = now.getTime();
  const start = Date.parse(concert.startsAt);
  const end = Date.parse(concert.endsAt);
  if (nowMs < start) return { kind: "upcoming", startsInMin: Math.ceil((start - nowMs) / MINUTE_MS) };
  if (nowMs < end) return { kind: "now" };
  return { kind: "played" };
}

/** 132 → { hours: 2, minutes: 12 }. */
export function hoursAndMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const m = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(m / MINUTES_PER_HOUR), minutes: m % MINUTES_PER_HOUR };
}

/** Pass band: „S1 · Scena Główna · teraz” / „… · za 2 h 12 min” / „… · zagrane”. */
export function passBandLabel(stageNo: number, stageName: string, timing: ConcertTiming): string {
  switch (timing.kind) {
    case "now":
      return t.band(stageNo, stageName, t.now);
    case "played":
      return t.band(stageNo, stageName, t.played);
    case "upcoming": {
      const { hours, minutes } = hoursAndMinutes(timing.startsInMin);
      return t.band(stageNo, stageName, t.startsIn(hours, minutes));
    }
  }
}

/**
 * Everything the big pass shows (NowPass formats reused through toNowPassProps).
 * `serial` comes from the caller: passSerial (planRows), the same function the
 * Plan's NowPass uses, so both screens show one number.
 */
export function toConcertPassProps(
  concert: Concert,
  stage: Stage,
  stageCodes: StageCodes,
  serial: string,
  now: Date,
): ConcertPassProps {
  const base = toNowPassProps(concert, stage, { inPlan: false, serial, accentSuppressed: true, stageCodes, now });
  const stageNo = stageNumber(stageIdOf(stage, stageCodes));
  const timing = concertTiming(concert, now);
  const start = formatTime(concert.startsAt);
  const end = formatTime(concert.endsAt);
  const length = Math.max(0, Math.round((Date.parse(concert.endsAt) - Date.parse(concert.startsAt)) / MINUTE_MS));

  let accessibilityLabel: string;
  switch (timing.kind) {
    case "now":
      accessibilityLabel = t.a11y.passNow(concert.artist, stageNo, stage.name, start, end, base.remainingMin);
      break;
    case "upcoming": {
      const { hours, minutes } = hoursAndMinutes(timing.startsInMin);
      accessibilityLabel = t.a11y.passUpcoming(concert.artist, stageNo, stage.name, start, end, hours, minutes, length);
      break;
    }
    case "played":
      accessibilityLabel = t.a11y.passPlayed(concert.artist, stageNo, stage.name, start, end);
      break;
  }

  return {
    band: passBandLabel(stageNo, stage.name, timing),
    artist: concert.artist,
    when: t.when(dayLabel(festivalDayOf(concert.startsAt)), base.range),
    progress: timing.kind === "now" ? base.progress : null,
    remaining: timing.kind === "now" ? strings.plan.pass.remaining(base.remainingMin) : null,
    duration: timing.kind === "upcoming" ? t.duration(length) : null,
    serial: strings.plan.pass.serial(base.serial),
    accessibilityLabel,
  };
}

/* ------------------------------------------------------------------ */
/* Conflict                                                             */
/* ------------------------------------------------------------------ */

export interface ConflictTag {
  readonly label: string;
  readonly accessibilityLabel: string;
}

/**
 * E05b: „Kolizja · Hanna Sieradz, S2 do 22:30” – only for a concert that is
 * NOT in the plan and overlaps a planned one (firstConflict, domain rule).
 */
export function conflictTagOf(
  concert: Concert,
  inPlan: boolean,
  planned: readonly Concert[],
  stages: readonly Stage[],
  stageCodes: StageCodes,
): ConflictTag | null {
  if (inPlan) return null;
  const other = firstConflict(
    concert,
    planned.filter((c) => c.id !== concert.id),
  );
  if (other === undefined) return null;
  const stage = stages.find((s) => s.id === other.stageId);
  const stageNo = stage === undefined ? 0 : stageNumber(stageIdOf(stage, stageCodes));
  const end = formatTime(other.endsAt);
  return {
    label: t.conflict(other.artist, stageNo, end),
    accessibilityLabel: t.a11y.conflict(other.artist, stageNo, stage?.name ?? "", end),
  };
}

/* ------------------------------------------------------------------ */
/* Distance and check-in                                                */
/* ------------------------------------------------------------------ */

/** Metres to the stage (domain geofence); null without a position or with bad coordinates. */
export function distanceToStage(position: Coordinates | null, stageLocation: Coordinates): number | null {
  if (position === null) return null;
  try {
    return checkGeofence(position, stageLocation).distanceMeters;
  } catch (error) {
    if (error instanceof DomainError) return null;
    throw error;
  }
}

export type CheckInWindow = "open" | "notYet" | "ended";

/** Domain window (from 15 min before the start to the end). Bad times never throw while rendering. */
export function checkInWindowOf(concert: Pick<Concert, "id" | "startsAt" | "endsAt">, now: Date): CheckInWindow {
  try {
    if (isCheckInOpen(concert, now)) return "open";
  } catch (error) {
    if (error instanceof DomainError) return "ended";
    throw error;
  }
  return now.getTime() < Date.parse(concert.startsAt) ? "notYet" : "ended";
}

export type CheckInStatus =
  | { readonly kind: "checkedIn" }
  | { readonly kind: "closed"; readonly window: "notYet" | "ended" }
  | { readonly kind: "permissionDenied" }
  | { readonly kind: "noLocation" }
  | { readonly kind: "inRange"; readonly distanceM: number }
  | { readonly kind: "tooFar"; readonly distanceM: number };

export interface CheckInStatusInput {
  /** From the store – already true while the write is in flight (optimistic). */
  readonly checkedIn: boolean;
  readonly window: CheckInWindow;
  readonly permission: LocationPermission;
  readonly position: Coordinates | null;
  readonly stageLocation: Coordinates;
}

/**
 * Order: checked in (Optimistic UI – the store marks it at the tap and rolls
 * it back on failure), then the time window, then GPS, then the 50 m geofence.
 */
export function checkInStatusOf(input: CheckInStatusInput): CheckInStatus {
  if (input.checkedIn) return { kind: "checkedIn" };
  if (input.window !== "open") return { kind: "closed", window: input.window };
  if (input.permission === "denied") return { kind: "permissionDenied" };
  if (input.position === null) return { kind: "noLocation" };
  try {
    const { isInside, distanceMeters } = checkGeofence(input.position, input.stageLocation);
    return isInside ? { kind: "inRange", distanceM: distanceMeters } : { kind: "tooFar", distanceM: distanceMeters };
  } catch (error) {
    if (error instanceof DomainError) return { kind: "noLocation" };
    throw error;
  }
}

/** Share of the CheckInRange bar, 0–1. Negative or unknown → 0, beyond the scale → 1. */
export function rangeProgress(distanceM: number, scaleM: number = CHECK_IN_RANGE_SCALE_M): number {
  if (!Number.isFinite(distanceM) || !Number.isFinite(scaleM) || scaleM <= 0) {
    return distanceM === Infinity ? 1 : 0;
  }
  return Math.min(1, Math.max(0, distanceM / scaleM));
}

/** CheckInRange props for a distance outside the radius (E05b). */
export function toCheckInRangeProps(distanceM: number): CheckInRangeProps {
  return {
    title: t.tooFar(CHECK_IN_RADIUS_METERS),
    zone: rangeProgress(CHECK_IN_RADIUS_METERS),
    progress: rangeProgress(distanceM),
    stageLabel: t.rangeStage(CHECK_IN_RADIUS_METERS),
    youLabel: t.rangeYou(formatDistance(distanceM)),
  };
}

/** DistanceGauge state from the permission and the distance. */
export function gaugeStateOf(permission: LocationPermission, distanceM: number | null): DistanceGaugeState {
  if (permission === "denied") return "noPermission";
  if (distanceM === null) return "locating";
  return distanceM <= CHECK_IN_RADIUS_METERS ? "inRange" : "tooFar";
}

/** TalkBack 3: „Odległość od sceny: 30 metrów. W zasięgu check-inu.” */
export function gaugeA11yLabel(state: DistanceGaugeState, distanceM: number | null): string {
  switch (state) {
    case "inRange":
      return t.a11y.gaugeInRange(spokenDistance(distanceM ?? 0));
    case "tooFar":
      return t.a11y.gaugeTooFar(spokenDistance(distanceM ?? 0), CHECK_IN_RADIUS_METERS);
    case "locating":
      return t.a11y.gaugeLocating;
    case "noPermission":
      return t.a11y.gaugeNoPermission;
  }
}

/**
 * useThrottledA11yLabel (C06) works on compass states; the gauge maps onto
 * them so that crossing the 50 m line or losing GPS is announced at once,
 * and plain distance changes at most every 10 s.
 */
export function gaugeAnnounceState(state: DistanceGaugeState): CompassState {
  switch (state) {
    case "inRange":
      return "near";
    case "tooFar":
      return "guiding";
    case "locating":
      return "calibrating";
    case "noPermission":
      return "noHeading";
  }
}

export interface CheckInNote {
  readonly label: string;
  readonly accessibilityLabel: string;
}

/** Rollback of this concert's check-in → StatusTag error (null = nothing to show). */
export function checkInErrorNote(error: CheckInError | null, concertId: string): CheckInNote | null {
  if (error === null || error.kind === "loadFailed" || error.concertId !== concertId) return null;
  switch (error.kind) {
    case "tooFar": {
      const distance = formatDistance(error.distanceMeters);
      return { label: t.error.tooFar(distance), accessibilityLabel: t.a11y.tooFarError(spokenDistance(error.distanceMeters)) };
    }
    case "closed":
      return { label: t.error.closed, accessibilityLabel: t.a11y.closedError };
    case "locationUnavailable":
      return { label: t.error.locationUnavailable, accessibilityLabel: t.a11y.locationError };
    case "saveFailed":
      return { label: t.error.saveFailed, accessibilityLabel: t.a11y.saveFailedError };
  }
}

/** Reason under the disabled check-in button (null = enabled, or the screen shows it elsewhere). */
export function checkInDisabledReason(status: CheckInStatus): string | null {
  switch (status.kind) {
    case "closed":
      return status.window === "notYet"
        ? t.reason.notYet(Math.round(CHECK_IN_OPENS_BEFORE_MS / MINUTE_MS))
        : t.reason.ended;
    case "permissionDenied":
    case "noLocation":
      return t.reason.noLocation;
    default:
      return null;
  }
}
