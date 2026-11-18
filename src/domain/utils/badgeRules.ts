import type { BadgeProgress } from "../entities/Badge";
import type { IsoDateString } from "../entities/common";
import type { FestivalEvent } from "../entities/Event";
import { DomainError } from "../errors/DomainError";

function parseDate(value: IsoDateString): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new DomainError("INVALID_DATE", `Invalid date: ${value}.`);
  }
  return parsed;
}

export function evaluatePreparedBadge(
  event: Pick<FestivalEvent, "startsAt" | "downloadedAt">,
): BadgeProgress {
  const startsAt = parseDate(event.startsAt);
  const earned =
    event.downloadedAt !== null && parseDate(event.downloadedAt) < startsAt;

  return { code: "prepared", progress: earned ? 1 : 0, goal: 1, earned };
}
