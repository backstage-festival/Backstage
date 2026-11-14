import type { Concert } from "../entities/Event";
import { DomainError } from "../errors/DomainError";

export const CHECK_IN_OPENS_BEFORE_MS = 15 * 60_000;

export function isCheckInOpen(
  concert: Pick<Concert, "id" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  const start = Date.parse(concert.startsAt);
  const end = Date.parse(concert.endsAt);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    throw new DomainError(
      "INVALID_TIME_RANGE",
      `Invalid time range for concert ${concert.id}.`,
    );
  }

  const nowMs = now.getTime();
  return nowMs >= start - CHECK_IN_OPENS_BEFORE_MS && nowMs <= end;
}
