import type { Departure, Stop, TransitAlert } from "../../domain/entities/Transit";
import { ApiError, fetchJson } from "./http";
import {
  isRecord,
  readArray,
  readNumber,
  readString,
  toIsoUtc,
  warsawLocalToIsoUtc,
} from "./parse";

const STOPS_URL =
  "https://ckan.multimediagdansk.pl/dataset/c24aa637-3619-4dc2-a171-a23eec8f2172/resource/4c4025f0-01bf-41f7-a39f-d156d201b82b/download/stops.json";
const DEPARTURES_URL = "https://ckan2.multimediagdansk.pl/departures";
const ALERTS_URL = "https://files.cloudgdansk.pl/d/otwarte-dane/ztm/bsk.json?v=2";

/** "Until further notice" in the ZTM alerts feed. */
const OPEN_ENDED_YEAR = "9999";

export type JsonFetcher = (url: string) => Promise<unknown>;

export class CkanClient {
  constructor(
    private readonly fetcher: JsonFetcher = fetchJson,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchStops(): Promise<readonly Stop[]> {
    const raw = await this.fetcher(STOPS_URL);
    if (!isRecord(raw)) {
      throw new ApiError("PARSE", `Stops response is not an object: ${STOPS_URL}`);
    }

    const day = this.pickDay(raw);
    const rows = day === null ? null : readArray(day, "stops");
    if (rows === null) {
      throw new ApiError("PARSE", `Stops response has no stops list: ${STOPS_URL}`);
    }

    return rows.map(mapStop).filter((stop): stop is Stop => stop !== null);
  }

  async fetchDepartures(stopId: number): Promise<readonly Departure[]> {
    const url = `${DEPARTURES_URL}?stopId=${encodeURIComponent(String(stopId))}`;
    const raw = await this.fetcher(url);
    if (!isRecord(raw)) {
      throw new ApiError("PARSE", `Departures response is not an object: ${url}`);
    }

    const rows = readArray(raw, "departures");
    if (rows === null) {
      throw new ApiError("PARSE", `Departures response has no departures list: ${url}`);
    }

    const fetchedAt = toIsoUtc(raw["lastUpdate"]) ?? this.now().toISOString();

    return rows
      .map((row) => mapDeparture(row, stopId, fetchedAt))
      .filter((departure): departure is Departure => departure !== null)
      .sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  }

  async fetchAlerts(): Promise<readonly TransitAlert[]> {
    const raw = await this.fetcher(ALERTS_URL);
    if (!isRecord(raw)) {
      throw new ApiError("PARSE", `Alerts response is not an object: ${ALERTS_URL}`);
    }

    const rows = readArray(raw, "results");
    if (rows === null) {
      throw new ApiError("PARSE", `Alerts response has no results list: ${ALERTS_URL}`);
    }

    const metadata = raw["metadata"];
    const generatedAt = isRecord(metadata) ? toIsoUtc(metadata["generationDate"]) : null;
    const fetchedAt = generatedAt ?? this.now().toISOString();

    return rows
      .map((row) => mapAlert(row, fetchedAt))
      .filter((alert): alert is TransitAlert => alert !== null);
  }

  /**
   * stops.json is keyed by date ("2026-11-15": { stops: [...] }).
   * Take today's entry, otherwise the newest one in the file.
   */
  private pickDay(raw: Record<string, unknown>): Record<string, unknown> | null {
    const today = raw[this.now().toISOString().slice(0, 10)];
    if (isRecord(today)) {
      return today;
    }

    const newestKey = Object.keys(raw).sort().pop();
    const newest = newestKey === undefined ? undefined : raw[newestKey];
    return isRecord(newest) ? newest : null;
  }
}

function mapStop(row: unknown): Stop | null {
  if (!isRecord(row)) {
    return null;
  }
  if (row["virtual"] === 1 || row["nonpassenger"] === 1 || row["depot"] === 1) {
    return null;
  }

  const id = readNumber(row, "stopId");
  const name = readString(row, "stopName") ?? readString(row, "stopDesc");
  const latitude = readNumber(row, "stopLat");
  const longitude = readNumber(row, "stopLon");
  if (id === null || name === null || latitude === null || longitude === null) {
    return null;
  }
  if (!isValidCoordinate(latitude, longitude)) {
    return null;
  }

  const subName = readString(row, "subName");
  return {
    id,
    name: subName === null ? name : `${name} ${subName}`,
    location: { latitude, longitude },
  };
}

function mapDeparture(row: unknown, stopId: number, fetchedAt: string): Departure | null {
  if (!isRecord(row)) {
    return null;
  }

  const routeId = readNumber(row, "routeId");
  const routeName =
    readString(row, "routeShortName") ?? (routeId === null ? null : String(routeId));
  const headsign = readString(row, "headsign");
  const departureAt = toIsoUtc(row["estimatedTime"]) ?? toIsoUtc(row["theoreticalTime"]);
  if (routeName === null || headsign === null || departureAt === null) {
    return null;
  }

  return {
    stopId,
    routeName,
    headsign,
    departureAt,
    delaySeconds: readNumber(row, "delayInSeconds"),
    fetchedAt,
  };
}

function mapAlert(row: unknown, fetchedAt: string): TransitAlert | null {
  if (!isRecord(row)) {
    return null;
  }

  const title = readString(row, "title");
  const validFrom = warsawLocalToIsoUtc(row["publishFrom"]);
  if (title === null || validFrom === null) {
    return null;
  }

  const content = readString(row, "content");
  const body = (content === null ? null : stripHtml(content)) ?? readString(row, "summary") ?? title;

  const publishTo = readString(row, "publishTo");
  const validTo =
    publishTo === null || publishTo.startsWith(OPEN_ENDED_YEAR)
      ? null
      : warsawLocalToIsoUtc(publishTo);

  return {
    id: readString(row, "url") ?? `${title}|${validFrom}`,
    title,
    body,
    validFrom,
    validTo,
    fetchedAt,
  };
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** ZTM sends alert content as HTML paragraphs - keep plain text with line breaks. */
export function stripHtml(html: string): string | null {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");

  return text === "" ? null : text;
}
