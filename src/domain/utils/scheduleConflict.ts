import type { Concert } from "../entities/Event";
import { DomainError } from "../errors/DomainError";

type TimedConcert = Pick<Concert, "id" | "startsAt" | "endsAt">;

interface Interval {
  readonly start: number;
  readonly end: number;
}

function toInterval(concert: TimedConcert): Interval {
  const start = Date.parse(concert.startsAt);
  const end = Date.parse(concert.endsAt);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    throw new DomainError(
      "INVALID_TIME_RANGE",
      `Invalid time range for concert ${concert.id}.`,
    );
  }
  return { start, end };
}

export function findScheduleConflicts<T extends TimedConcert>(
  candidate: TimedConcert,
  planned: readonly T[],
): T[] {
  const target = toInterval(candidate);

  return planned.filter((concert) => {
    if (concert.id === candidate.id) return false;
    const other = toInterval(concert);
    return target.start < other.end && other.start < target.end;
  });
}

export function hasScheduleConflict(
  candidate: TimedConcert,
  planned: readonly TimedConcert[],
): boolean {
  return findScheduleConflicts(candidate, planned).length > 0;
}
