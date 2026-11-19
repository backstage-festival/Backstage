import type { BadgeProgress } from "../entities/Badge";
import type { IsoDateString } from "../entities/common";
import type { Concert, FestivalEvent } from "../entities/Event";
import type { CheckIn } from "../entities/Schedule";
import { DomainError } from "../errors/DomainError";

export const FESTIVAL_UTC_OFFSET_MINUTES = 120;
export const NIGHT_ENDS_AT_HOUR = 6;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const FESTIVAL_OFFSET_MS = FESTIVAL_UTC_OFFSET_MINUTES * 60_000;

type BadgeConcert = Pick<Concert, "id" | "startsAt" | "endsAt">;

function parseDate(value: IsoDateString): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new DomainError("INVALID_DATE", `Invalid date: ${value}.`);
  }
  return parsed;
}

function parseConcertRange(concert: BadgeConcert): {
  start: number;
  end: number;
} {
  const start = parseDate(concert.startsAt);
  const end = parseDate(concert.endsAt);
  if (end <= start) {
    throw new DomainError(
      "INVALID_TIME_RANGE",
      `Invalid time range for concert ${concert.id}.`,
    );
  }
  return { start, end };
}

function festivalMidnightBefore(ms: number): number {
  const localMs = ms + FESTIVAL_OFFSET_MS;
  return Math.floor(localMs / DAY_MS) * DAY_MS - FESTIVAL_OFFSET_MS;
}

function isLateNightConcert(concert: BadgeConcert): boolean {
  const { start, end } = parseConcertRange(concert);

  for (
    let midnight = festivalMidnightBefore(start);
    midnight < end;
    midnight += DAY_MS
  ) {
    const nightEnd = midnight + NIGHT_ENDS_AT_HOUR * HOUR_MS;
    if (start < nightEnd && end > midnight) return true;
  }
  return false;
}

function checkedInConcerts<T extends Pick<Concert, "id">>(
  checkIns: readonly Pick<CheckIn, "concertId">[],
  concerts: readonly T[],
): T[] {
  const byId = new Map(concerts.map((concert) => [concert.id, concert]));
  const result: T[] = [];
  for (const checkIn of checkIns) {
    const concert = byId.get(checkIn.concertId);
    if (concert !== undefined) result.push(concert);
  }
  return result;
}

export function evaluatePreparedBadge(
  event: Pick<FestivalEvent, "startsAt" | "downloadedAt">,
): BadgeProgress {
  const startsAt = parseDate(event.startsAt);
  const earned =
    event.downloadedAt !== null && parseDate(event.downloadedAt) < startsAt;

  return { code: "prepared", progress: earned ? 1 : 0, goal: 1, earned };
}

export function evaluateNightOwlBadge(
  checkIns: readonly Pick<CheckIn, "concertId">[],
  concerts: readonly BadgeConcert[],
): BadgeProgress {
  const earned = checkedInConcerts(checkIns, concerts).some(isLateNightConcert);

  return { code: "night_owl", progress: earned ? 1 : 0, goal: 1, earned };
}

export const THREE_STAGES_GOAL = 3;

function festivalDayKey(ms: number): number {
  return Math.floor(
    (ms + FESTIVAL_OFFSET_MS - NIGHT_ENDS_AT_HOUR * HOUR_MS) / DAY_MS,
  );
}

export function evaluateAllDaysBadge(
  checkIns: readonly Pick<CheckIn, "concertId">[],
  concerts: readonly Pick<Concert, "id" | "startsAt">[],
): BadgeProgress {
  const festivalDays = new Set(
    concerts.map((concert) => festivalDayKey(parseDate(concert.startsAt))),
  );
  const visitedDays = new Set(
    checkedInConcerts(checkIns, concerts).map((concert) =>
      festivalDayKey(parseDate(concert.startsAt)),
    ),
  );
  const goal = Math.max(festivalDays.size, 1);
  const progress = visitedDays.size;

  return {
    code: "all_three_days",
    progress,
    goal,
    earned: festivalDays.size > 0 && progress >= goal,
  };
}

export function evaluateThreeStagesBadge(
  checkIns: readonly Pick<CheckIn, "concertId">[],
  concerts: readonly Pick<Concert, "id" | "stageId">[],
): BadgeProgress {
  const visitedStages = new Set(
    checkedInConcerts(checkIns, concerts).map((concert) => concert.stageId),
  );
  const progress = Math.min(visitedStages.size, THREE_STAGES_GOAL);

  return {
    code: "three_stages",
    progress,
    goal: THREE_STAGES_GOAL,
    earned: progress >= THREE_STAGES_GOAL,
  };
}
