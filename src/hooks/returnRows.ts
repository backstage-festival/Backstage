/**
 * Pure Powrót logic: stops + departures → flat list rows (stop header, then
 * its departures) with fixed heights. The leave state comes from the transit
 * selector; this file only orders and maps.
 */
import { DEPARTURE_ROW_HEIGHT, type DepartureRowViewProps } from "@/components/DepartureRow";
import { toDepartureRowProps, walkMeta, walkSecondsFor } from "@/components/mappers";
import { stopHeaderHeight } from "@/components/StopHeader";
import type { Departure } from "@/domain/entities/Transit";
import type { DataFreshness, DepartureState } from "@/types/components";
import type { NearbyStop } from "@/use-cases/GetNearbyStopsUseCase";

export interface StopHeaderData {
  readonly stopId: number;
  readonly name: string;
  readonly meta: string;
  readonly freshness: DataFreshness;
  readonly first: boolean;
}

export type ReturnRow =
  | { readonly type: "stop"; readonly key: string; readonly header: StopHeaderData }
  | { readonly type: "departure"; readonly key: string; readonly row: DepartureRowViewProps };

export interface ReturnRowsInput {
  readonly stops: readonly NearbyStop[];
  readonly departures: Readonly<Record<number, readonly Departure[]>>;
  readonly now: Date;
  /** Data older than the TTL: timetable times, no live delays. */
  readonly timetableOnly: boolean;
  readonly upcoming: (departures: readonly Departure[], now: Date, timetableOnly: boolean) => readonly Departure[];
  readonly stateOf: (departure: Departure, walkSeconds: number, now: Date, timetableOnly: boolean) => DepartureState;
}

/** Stops without a departure still to come are left out. */
export function buildReturnRows(input: ReturnRowsInput): readonly ReturnRow[] {
  const { stops, departures, now, timetableOnly, upcoming, stateOf } = input;
  const rows: ReturnRow[] = [];

  for (const stop of stops) {
    const next = upcoming(departures[stop.id] ?? [], now, timetableOnly);
    if (next.length === 0) continue;

    const walkSeconds = walkSecondsFor(stop.distanceMeters);
    const mapped = next.map((departure) =>
      toDepartureRowProps(departure, walkSeconds, stateOf(departure, walkSeconds, now, timetableOnly), {
        now,
        timetableOnly,
      }),
    );
    const firstSkm = mapped.findIndex((row) => row.kind === "skm");

    rows.push({
      type: "stop",
      key: `stop-${stop.id}`,
      header: {
        stopId: stop.id,
        name: stop.name,
        meta: walkMeta(walkSeconds),
        freshness: mapped.every((row) => row.freshness === "live") ? "live" : "stale",
        first: rows.length === 0,
      },
    });
    mapped.forEach((row, index) => {
      const departure = next[index];
      rows.push({
        type: "departure",
        key: `dep-${stop.id}-${departure?.routeName ?? ""}-${departure?.departureAt ?? index}`,
        row: { ...row, spellOutKind: index === firstSkm },
      });
    });
  }
  return rows;
}

export function returnRowHeight(row: ReturnRow): number {
  return row.type === "stop" ? stopHeaderHeight(row.header.first) : DEPARTURE_ROW_HEIGHT;
}

const MINUTE_MS = 60_000;

/** Data age split for „2 h 10 min temu”. */
export function ageParts(ageMs: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(ageMs / MINUTE_MS));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
