import type { IsoDateString } from "../entities/common";
import type { FestivalEvent } from "../entities/Event";
import { DomainError } from "../errors/DomainError";

export type CachedDataKind = "departures" | "transitAlerts" | "weather";

export const CACHE_TTL_MS: Readonly<Record<CachedDataKind, number>> = {
  departures: 10 * 60_000,
  transitAlerts: 60 * 60_000,
  weather: 3 * 60 * 60_000,
};

export interface CacheFreshness {
  readonly isValid: boolean;
  readonly ageMs: number;
  readonly expiresAt: IsoDateString;
}

function parseDate(value: IsoDateString): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new DomainError("INVALID_DATE", `Invalid date: ${value}.`);
  }
  return parsed;
}

export function getCacheFreshness(
  fetchedAt: IsoDateString,
  kind: CachedDataKind,
  now: Date = new Date(),
): CacheFreshness {
  const fetchedMs = parseDate(fetchedAt);
  const ttl = CACHE_TTL_MS[kind];
  const ageMs = Math.max(0, now.getTime() - fetchedMs);

  return {
    isValid: ageMs < ttl,
    ageMs,
    expiresAt: new Date(fetchedMs + ttl).toISOString(),
  };
}

export function isCacheValid(
  fetchedAt: IsoDateString,
  kind: CachedDataKind,
  now: Date = new Date(),
): boolean {
  return getCacheFreshness(fetchedAt, kind, now).isValid;
}

export function isEventPackageValid(
  event: Pick<FestivalEvent, "downloadedAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  if (event.downloadedAt === null) return false;
  parseDate(event.downloadedAt);
  return now.getTime() <= parseDate(event.endsAt);
}
