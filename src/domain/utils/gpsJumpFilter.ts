import type { GpsFix } from "../entities/common";
import { DomainError } from "../errors/DomainError";
import { calculateDistanceInMeters } from "./distanceCalculator";
import { assertValidCoordinates } from "./geofence";

export const MAX_PLAUSIBLE_SPEED_MPS = 25;
export const MAX_ACCEPTED_ACCURACY_METERS = 50;

export type GpsRejectionReason = "low_accuracy" | "out_of_order" | "too_fast";

export type GpsFilterResult =
  | { readonly accepted: true; readonly speedMps: number | null }
  | { readonly accepted: false; readonly reason: GpsRejectionReason };

function assertValidFix(fix: GpsFix): void {
  assertValidCoordinates(fix.location);

  const accuracyValid =
    fix.accuracyMeters === null ||
    (Number.isFinite(fix.accuracyMeters) && fix.accuracyMeters >= 0);

  if (!Number.isFinite(fix.timestamp) || !accuracyValid) {
    throw new DomainError("INVALID_GPS_FIX", "Invalid GPS fix.");
  }
}

export function evaluateGpsFix(
  next: GpsFix,
  previous: GpsFix | null,
): GpsFilterResult {
  assertValidFix(next);

  if (
    next.accuracyMeters !== null &&
    next.accuracyMeters > MAX_ACCEPTED_ACCURACY_METERS
  ) {
    return { accepted: false, reason: "low_accuracy" };
  }

  if (previous === null) return { accepted: true, speedMps: null };
  assertValidFix(previous);

  const elapsedSeconds = (next.timestamp - previous.timestamp) / 1000;
  if (elapsedSeconds <= 0) return { accepted: false, reason: "out_of_order" };

  const distanceMeters = calculateDistanceInMeters(
    previous.location.latitude,
    previous.location.longitude,
    next.location.latitude,
    next.location.longitude,
  );
  const speedMps = distanceMeters / elapsedSeconds;

  if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) {
    return { accepted: false, reason: "too_fast" };
  }
  return { accepted: true, speedMps };
}

export function filterGpsFixes(fixes: readonly GpsFix[]): GpsFix[] {
  const accepted: GpsFix[] = [];

  for (const fix of fixes) {
    const lastAccepted = accepted[accepted.length - 1] ?? null;
    if (evaluateGpsFix(fix, lastAccepted).accepted) {
      accepted.push(fix);
    }
  }
  return accepted;
}
