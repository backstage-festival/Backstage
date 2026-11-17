import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Concert,
  EventPackage,
  FestivalEvent,
  Poi,
  PoiType,
  Stage,
} from "../../domain/entities/Event";
import { ApiError } from "./http";
import { isRecord, readNumber, readString, toIsoUtc } from "./parse";

const POI_TYPES: readonly PoiType[] = ["toilet", "water", "medical", "gate", "food"];

interface QueryResult {
  readonly data: unknown;
  readonly error: { readonly message: string } | null;
}

export class SupabaseEventApiClient {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Downloads everything the app needs offline for one event.
   * The four queries run in parallel; broken rows are skipped,
   * a missing or broken event row fails the whole download.
   */
  async fetchEventPackage(eventId: string): Promise<EventPackage> {
    const [eventResult, stagesResult, concertsResult, poisResult] = await Promise.all([
      this.supabase
        .from("events")
        .select("id, name, starts_at, ends_at")
        .eq("id", eventId)
        .maybeSingle(),
      this.supabase
        .from("stages")
        .select("id, event_id, name, latitude, longitude")
        .eq("event_id", eventId),
      this.supabase
        .from("concerts")
        .select("id, event_id, stage_id, artist, starts_at, ends_at")
        .eq("event_id", eventId)
        .order("starts_at"),
      this.supabase
        .from("pois")
        .select("id, event_id, type, name, latitude, longitude")
        .eq("event_id", eventId),
    ]);

    const eventRow = unwrap(eventResult, "events");
    if (eventRow === null) {
      throw new ApiError("HTTP", `Event not found in Supabase: ${eventId}`);
    }
    const event = mapEvent(eventRow);
    if (event === null) {
      throw new ApiError("PARSE", `Event row from Supabase is invalid: ${eventId}`);
    }

    const stages = mapRows(unwrap(stagesResult, "stages"), mapStage);
    const stageIds = new Set(stages.map((stage) => stage.id));
    // SQLite has foreign keys ON - a concert on an unknown stage would break the insert.
    const concerts = mapRows(unwrap(concertsResult, "concerts"), mapConcert).filter(
      (concert) => stageIds.has(concert.stageId),
    );
    const pois = mapRows(unwrap(poisResult, "pois"), mapPoi);

    return { event, stages, concerts, pois };
  }
}

function unwrap(result: QueryResult, table: string): unknown {
  if (result.error !== null) {
    throw new ApiError("HTTP", `Supabase query on ${table} failed: ${result.error.message}`);
  }
  return result.data;
}

function mapRows<T>(data: unknown, mapRow: (row: unknown) => T | null): T[] {
  if (!Array.isArray(data)) {
    throw new ApiError("PARSE", "Supabase returned a non-list result");
  }
  return data.map(mapRow).filter((item): item is T => item !== null);
}

function mapEvent(row: unknown): FestivalEvent | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = readString(row, "id");
  const name = readString(row, "name");
  const startsAt = toIsoUtc(row["starts_at"]);
  const endsAt = toIsoUtc(row["ends_at"]);
  if (id === null || name === null || startsAt === null || endsAt === null) {
    return null;
  }
  return { id, name, startsAt, endsAt, downloadedAt: null };
}

function mapStage(row: unknown): Stage | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = readString(row, "id");
  const eventId = readString(row, "event_id");
  const name = readString(row, "name");
  const location = readLocation(row);
  if (id === null || eventId === null || name === null || location === null) {
    return null;
  }
  return { id, eventId, name, location };
}

function mapConcert(row: unknown): Concert | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = readString(row, "id");
  const eventId = readString(row, "event_id");
  const stageId = readString(row, "stage_id");
  const artist = readString(row, "artist");
  const startsAt = toIsoUtc(row["starts_at"]);
  const endsAt = toIsoUtc(row["ends_at"]);
  if (
    id === null ||
    eventId === null ||
    stageId === null ||
    artist === null ||
    startsAt === null ||
    endsAt === null ||
    endsAt <= startsAt
  ) {
    return null;
  }
  return { id, eventId, stageId, artist, startsAt, endsAt };
}

function mapPoi(row: unknown): Poi | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = readString(row, "id");
  const eventId = readString(row, "event_id");
  const type = readPoiType(row);
  const name = readString(row, "name");
  const location = readLocation(row);
  if (id === null || eventId === null || type === null || name === null || location === null) {
    return null;
  }
  return { id, eventId, type, name, location };
}

function readPoiType(row: Record<string, unknown>): PoiType | null {
  const value = readString(row, "type");
  return POI_TYPES.find((type) => type === value) ?? null;
}

function readLocation(
  row: Record<string, unknown>,
): { latitude: number; longitude: number } | null {
  const latitude = readNumber(row, "latitude");
  const longitude = readNumber(row, "longitude");
  if (latitude === null || longitude === null) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}
