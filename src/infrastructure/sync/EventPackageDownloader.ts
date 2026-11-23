import type { Coordinates } from "../../domain/entities/common";
import type { EventPackage, Stage } from "../../domain/entities/Event";
import type {
  Departure,
  Stop,
  TransitAlert,
} from "../../domain/entities/Transit";
import type { WeatherForecast } from "../../domain/entities/Weather";
import { calculateDistanceInMeters } from "../../domain/utils/distanceCalculator";
import { getDb } from "../storage/database";
import { writeEventPackage } from "../storage/repositories/SqliteEventRepository";
import {
  writeAlerts,
  writeDepartures,
  writeStops,
} from "../storage/repositories/SqliteTransitRepository";
import { writeWeather } from "../storage/repositories/SqliteWeatherRepository";

export type DownloadStep =
  | "event"
  | "stops"
  | "departures"
  | "alerts"
  | "weather"
  | "saving";

export interface DownloadProgress {
  readonly step: DownloadStep;
  readonly completed: number;
  readonly total: number;
}

export type DownloadProgressListener = (progress: DownloadProgress) => void;

export interface EventPackageSource {
  fetchEventPackage(eventId: string): Promise<EventPackage>;
}

export interface TransitSource {
  fetchStops(): Promise<readonly Stop[]>;
  fetchDepartures(stopId: number): Promise<readonly Departure[]>;
  fetchAlerts(): Promise<readonly TransitAlert[]>;
}

export interface WeatherSource {
  fetchForecast(
    eventId: string,
    location: Coordinates,
  ): Promise<readonly WeatherForecast[]>;
}

export const STOP_RADIUS_METERS = 1000;
export const MAX_STOPS = 10;
const TOTAL_STEPS = 6;

interface StopDepartures {
  readonly stopId: number;
  readonly departures: readonly Departure[];
}

export class EventPackageDownloader {
  constructor(
    private readonly eventSource: EventPackageSource,
    private readonly transitSource: TransitSource,
    private readonly weatherSource: WeatherSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async download(
    eventId: string,
    onProgress?: DownloadProgressListener,
  ): Promise<void> {
    const eventPackage = await this.eventSource.fetchEventPackage(eventId);
    onProgress?.({ step: "event", completed: 1, total: TOTAL_STEPS });

    const stops = await this.transitSource.fetchStops();
    onProgress?.({ step: "stops", completed: 2, total: TOTAL_STEPS });

    const nearbyStops = pickStopsNearStages(stops, eventPackage.stages);
    const departuresByStop: StopDepartures[] = [];
    for (const stop of nearbyStops) {
      const departures = await this.transitSource.fetchDepartures(stop.id);
      departuresByStop.push({ stopId: stop.id, departures });
    }
    onProgress?.({ step: "departures", completed: 3, total: TOTAL_STEPS });

    const alerts = await this.transitSource.fetchAlerts();
    onProgress?.({ step: "alerts", completed: 4, total: TOTAL_STEPS });

    const stage = eventPackage.stages[0];
    const forecasts = stage
      ? await this.weatherSource.fetchForecast(eventId, stage.location)
      : [];
    onProgress?.({ step: "weather", completed: 5, total: TOTAL_STEPS });

    const downloadedPackage: EventPackage = {
      ...eventPackage,
      event: {
        ...eventPackage.event,
        downloadedAt: this.now().toISOString(),
      },
    };

    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await writeEventPackage(txn, downloadedPackage);
      await writeWeather(txn, eventId, forecasts);
      await writeStops(txn, stops);
      for (const { stopId, departures } of departuresByStop) {
        await writeDepartures(txn, stopId, departures);
      }
      await writeAlerts(txn, alerts);
    });
    onProgress?.({ step: "saving", completed: 6, total: TOTAL_STEPS });
  }
}

function pickStopsNearStages(
  stops: readonly Stop[],
  stages: readonly Stage[],
): readonly Stop[] {
  return stops
    .map((stop) => ({
      stop,
      distance: Math.min(
        ...stages.map((stage) =>
          calculateDistanceInMeters(
            stop.location.latitude,
            stop.location.longitude,
            stage.location.latitude,
            stage.location.longitude,
          ),
        ),
      ),
    }))
    .filter(({ distance }) => distance <= STOP_RADIUS_METERS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_STOPS)
    .map(({ stop }) => stop);
}
