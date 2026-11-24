// TEMP: demo clock helpers until real event data (#22/#32)
import type { IsoDateString } from "@/domain/entities/common";

const MINUTE_MS = 60_000;

/** The demo "now": real time floored to a full minute (board times are whole minutes). */
export function demoAnchor(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
}

/**
 * Moves a fixed board timestamp so that `boardNow` (the clock shown on the
 * board) lands on `anchorMs`. Distances between timestamps stay the same, so
 * conflicts, "37 min left" or "40 min in the queue" look like on the boards.
 */
export function shiftIso(iso: IsoDateString, boardNow: Date, anchorMs: number): IsoDateString {
  return new Date(Date.parse(iso) + anchorMs - boardNow.getTime()).toISOString();
}

/** `anchorMs` plus whole minutes, as an ISO string. */
export function minutesFrom(anchorMs: number, minutes: number): IsoDateString {
  return new Date(anchorMs + minutes * MINUTE_MS).toISOString();
}
