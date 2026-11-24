import type { Coordinates } from "../../domain/entities/common";
import type { WeatherForecast, WeatherSummary } from "../../domain/entities/Weather";
import type { JsonFetcher } from "./CkanClient";
import { ApiError, fetchJson } from "./http";
import { isRecord, readArray, toIsoUtc } from "./parse";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const HOURLY_FIELDS = "temperature_2m,precipitation,weather_code";
const OPEN_METEO_HOUR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export interface HourlyColumns {
  readonly times: readonly unknown[];
  readonly temperatures: readonly unknown[];
  readonly precipitation: readonly unknown[];
  readonly weatherCodes: readonly unknown[];
}

export class OpenMeteoClient {
  constructor(
    private readonly fetcher: JsonFetcher = fetchJson,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchForecast(
    eventId: string,
    location: Coordinates,
  ): Promise<readonly WeatherForecast[]> {
    const url =
      `${FORECAST_URL}?latitude=${encodeURIComponent(String(location.latitude))}` +
      `&longitude=${encodeURIComponent(String(location.longitude))}` +
      `&hourly=${HOURLY_FIELDS}&timezone=GMT`;

    const raw = await this.fetcher(url);
    if (!isRecord(raw)) {
      throw new ApiError("PARSE", `Weather response is not an object: ${url}`);
    }
    const hourly = raw["hourly"];
    if (!isRecord(hourly)) {
      throw new ApiError("PARSE", `Weather response has no hourly data: ${url}`);
    }

    const times = readArray(hourly, "time");
    const temperatures = readArray(hourly, "temperature_2m");
    const precipitation = readArray(hourly, "precipitation");
    const weatherCodes = readArray(hourly, "weather_code");
    if (times === null || temperatures === null || precipitation === null || weatherCodes === null) {
      throw new ApiError("PARSE", `Weather response is missing hourly lists: ${url}`);
    }

    const fetchedAt = this.now().toISOString();
    return buildForecasts(eventId, fetchedAt, {
      times,
      temperatures,
      precipitation,
      weatherCodes,
    });
  }
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function openMeteoHourToIso(value: unknown): string | null {
  if (typeof value !== "string" || !OPEN_METEO_HOUR.test(value)) {
    return null;
  }
  return toIsoUtc(`${value}:00Z`);
}

export function buildForecasts(
  eventId: string,
  fetchedAt: string,
  columns: HourlyColumns,
): WeatherForecast[] {
  return columns.times
    .map((time, i): WeatherForecast | null => {
      const forecastFor = openMeteoHourToIso(time);
      const temperatureC = asNumber(columns.temperatures[i]);
      const rainMm = asNumber(columns.precipitation[i]);
      const code = asNumber(columns.weatherCodes[i]);
      if (
        forecastFor === null ||
        temperatureC === null ||
        rainMm === null ||
        code === null ||
        rainMm < 0
      ) {
        return null;
      }

      const summary = weatherCodeToSummary(code);
      if (summary === null) {
        return null;
      }

      return { eventId, forecastFor, temperatureC, rainMm, summary, fetchedAt };
    })
    .filter((f): f is WeatherForecast => f !== null);
}

export function weatherCodeToSummary(code: number): WeatherSummary | null {
  if (code === 0 || code === 1) {
    return "clear";
  }
  if (code === 2 || code === 3) {
    return "cloudy";
  }
  if (code === 45 || code === 48) {
    return "fog";
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return "rain";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return "snow";
  }
  if (code === 95 || code === 96 || code === 99) {
    return "storm";
  }
  return null;
}
