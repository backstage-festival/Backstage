import type { SQLiteDatabase } from "expo-sqlite";
import type {
  WeatherForecast,
  WeatherSummary,
} from "../../../domain/entities/Weather";
import type { IWeatherRepository } from "../../../domain/repositories/IWeatherRepository";
import { getDb } from "../database";
import { runForEach } from "./sqliteHelpers";

interface WeatherRow {
  event_id: string;
  forecast_for: string;
  temperature_c: number;
  rain_mm: number;
  summary: WeatherSummary;
  fetched_at: string;
}

function toWeatherForecast(row: WeatherRow): WeatherForecast {
  return {
    eventId: row.event_id,
    forecastFor: row.forecast_for,
    temperatureC: row.temperature_c,
    rainMm: row.rain_mm,
    summary: row.summary,
    fetchedAt: row.fetched_at,
  };
}

export async function writeWeather(
  txn: SQLiteDatabase,
  eventId: string,
  forecasts: readonly WeatherForecast[],
): Promise<void> {
  await txn.runAsync("DELETE FROM weather_forecasts WHERE event_id = ?", [
    eventId,
  ]);

  await runForEach(
    txn,
    "INSERT INTO weather_forecasts (event_id, forecast_for, temperature_c, rain_mm, summary, fetched_at) VALUES (?,?,?,?,?,?) ON CONFLICT(event_id, forecast_for) DO UPDATE SET temperature_c = excluded.temperature_c, rain_mm = excluded.rain_mm, summary = excluded.summary, fetched_at = excluded.fetched_at",
    forecasts,
    (forecast) => [
      eventId,
      forecast.forecastFor,
      forecast.temperatureC,
      forecast.rainMm,
      forecast.summary,
      forecast.fetchedAt,
    ],
  );
}

export class SqliteWeatherRepository implements IWeatherRepository {
  async getForecast(eventId: string): Promise<readonly WeatherForecast[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<WeatherRow>(
      "SELECT event_id, forecast_for, temperature_c, rain_mm, summary, fetched_at FROM weather_forecasts WHERE event_id = ? ORDER BY forecast_for",
      [eventId],
    );
    return rows.map(toWeatherForecast);
  }

  async saveForecast(
    eventId: string,
    forecasts: readonly WeatherForecast[],
  ): Promise<void> {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await writeWeather(txn, eventId, forecasts);
    });
  }
}
