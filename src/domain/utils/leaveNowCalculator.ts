import type { IsoDateString } from "../entities/common";
import { DomainError } from "../errors/DomainError";

export const DEFAULT_WALKING_SPEED_MPS = 1.2;
export const DEFAULT_BUFFER_SECONDS = 5 * 60;

export type LeaveStatus = "wait" | "leave_now" | "too_late";

export interface LeaveNowInput {
  readonly startsAt: IsoDateString;
  readonly distanceMeters: number;
  readonly walkingSpeedMps?: number;
  readonly bufferSeconds?: number;
}

export interface LeaveNowResult {
  readonly status: LeaveStatus;
  readonly leaveAt: IsoDateString;
  readonly secondsUntilLeave: number;
  readonly walkSeconds: number;
}

function resolveStatus(
  nowMs: number,
  leaveAtMs: number,
  latestDepartureMs: number,
): LeaveStatus {
  if (nowMs < leaveAtMs) return "wait";
  if (nowMs <= latestDepartureMs) return "leave_now";
  return "too_late";
}

export function calculateLeaveNow(
  input: LeaveNowInput,
  now: Date = new Date(),
): LeaveNowResult {
  const {
    startsAt,
    distanceMeters,
    walkingSpeedMps = DEFAULT_WALKING_SPEED_MPS,
    bufferSeconds = DEFAULT_BUFFER_SECONDS,
  } = input;

  const startMs = Date.parse(startsAt);
  const nowMs = now.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(nowMs)) {
    throw new DomainError("INVALID_DATE", `Invalid date: ${startsAt}.`);
  }

  const paramsValid =
    Number.isFinite(distanceMeters) &&
    distanceMeters >= 0 &&
    Number.isFinite(walkingSpeedMps) &&
    walkingSpeedMps > 0 &&
    Number.isFinite(bufferSeconds) &&
    bufferSeconds >= 0;
  if (!paramsValid) {
    throw new DomainError(
      "INVALID_LEAVE_PARAMS",
      "Invalid leave-now parameters.",
    );
  }

  const walkSeconds = Math.ceil(distanceMeters / walkingSpeedMps);
  const latestDepartureMs = startMs - walkSeconds * 1000;
  const leaveAtMs = latestDepartureMs - bufferSeconds * 1000;

  return {
    status: resolveStatus(nowMs, leaveAtMs, latestDepartureMs),
    leaveAt: new Date(leaveAtMs).toISOString(),
    secondsUntilLeave: Math.max(0, Math.ceil((leaveAtMs - nowMs) / 1000)),
    walkSeconds,
  };
}
