import type { EventPackage } from "../../../domain/entities/Event";
import type {
  Departure,
  Stop,
  TransitAlert,
} from "../../../domain/entities/Transit";
import type { WeatherForecast } from "../../../domain/entities/Weather";
import { writeEventPackage } from "../../storage/repositories/SqliteEventRepository";
import {
  writeAlerts,
  writeDepartures,
  writeStops,
} from "../../storage/repositories/SqliteTransitRepository";
import { writeWeather } from "../../storage/repositories/SqliteWeatherRepository";
import {
  type DownloadProgress,
  EventPackageDownloader,
  type EventPackageSource,
  type TransitSource,
  type WeatherSource,
} from "../EventPackageDownloader";

const mockTxn = {};
const mockDb = {
  withExclusiveTransactionAsync: jest.fn(
    async (task: (txn: object) => Promise<void>) => task(mockTxn),
  ),
};

jest.mock("../../storage/database", () => ({
  getDb: async () => mockDb,
}));

jest.mock("../../storage/repositories/SqliteEventRepository", () => ({
  writeEventPackage: jest.fn(),
}));

jest.mock("../../storage/repositories/SqliteTransitRepository", () => ({
  writeStops: jest.fn(),
  writeDepartures: jest.fn(),
  writeAlerts: jest.fn(),
}));

jest.mock("../../storage/repositories/SqliteWeatherRepository", () => ({
  writeWeather: jest.fn(),
}));

const NOW = new Date("2027-07-01T10:00:00.000Z");

const eventPackage: EventPackage = {
  event: {
    id: "event-1",
    name: "Stocznia Sound 2027",
    startsAt: "2027-07-02T14:00:00Z",
    endsAt: "2027-07-03T23:00:00Z",
    downloadedAt: null,
  },
  stages: [
    {
      id: "stage-1",
      eventId: "event-1",
      name: "Main",
      location: { latitude: 54.36, longitude: 18.65 },
    },
  ],
  concerts: [],
  pois: [],
};

const nearStop: Stop = {
  id: 1,
  name: "Stocznia SKM",
  location: { latitude: 54.361, longitude: 18.651 },
};

const farStop: Stop = {
  id: 2,
  name: "Oliwa",
  location: { latitude: 54.41, longitude: 18.56 },
};

const departure: Departure = {
  stopId: 1,
  routeName: "8",
  headsign: "Jelitkowo",
  departureAt: "2027-07-02T22:10:00Z",
  delaySeconds: 60,
  fetchedAt: "2027-07-01T09:59:00Z",
};

const alert: TransitAlert = {
  id: "alert-1",
  title: "Objazd",
  body: "Tramwaje jada objazdem.",
  validFrom: "2027-07-01T00:00:00Z",
  validTo: null,
  fetchedAt: "2027-07-01T09:59:00Z",
};

const forecast: WeatherForecast = {
  eventId: "event-1",
  forecastFor: "2027-07-02T18:00:00Z",
  temperatureC: 21.5,
  rainMm: 0,
  summary: "clear",
  fetchedAt: "2027-07-01T09:59:00Z",
};

function createSources() {
  const eventSource = {
    fetchEventPackage: jest.fn().mockResolvedValue(eventPackage),
  } satisfies EventPackageSource;
  const transitSource = {
    fetchStops: jest.fn().mockResolvedValue([nearStop, farStop]),
    fetchDepartures: jest.fn().mockResolvedValue([departure]),
    fetchAlerts: jest.fn().mockResolvedValue([alert]),
  } satisfies TransitSource;
  const weatherSource = {
    fetchForecast: jest.fn().mockResolvedValue([forecast]),
  } satisfies WeatherSource;
  return { eventSource, transitSource, weatherSource };
}

describe("EventPackageDownloader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves everything in one transaction and sets downloadedAt", async () => {
    const { eventSource, transitSource, weatherSource } = createSources();
    const downloader = new EventPackageDownloader(
      eventSource,
      transitSource,
      weatherSource,
      () => NOW,
    );

    await downloader.download("event-1");

    expect(eventSource.fetchEventPackage).toHaveBeenCalledWith("event-1");
    expect(mockDb.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(writeEventPackage).toHaveBeenCalledWith(mockTxn, {
      ...eventPackage,
      event: { ...eventPackage.event, downloadedAt: NOW.toISOString() },
    });
    expect(writeStops).toHaveBeenCalledWith(mockTxn, [nearStop, farStop]);
    expect(writeDepartures).toHaveBeenCalledWith(mockTxn, 1, [departure]);
    expect(writeAlerts).toHaveBeenCalledWith(mockTxn, [alert]);
  });

  it("reports progress for every step in order", async () => {
    const { eventSource, transitSource, weatherSource } = createSources();
    const downloader = new EventPackageDownloader(
      eventSource,
      transitSource,
      weatherSource,
      () => NOW,
    );
    const progress: DownloadProgress[] = [];

    await downloader.download("event-1", (p) => progress.push(p));

    expect(progress).toEqual([
      { step: "event", completed: 1, total: 6 },
      { step: "stops", completed: 2, total: 6 },
      { step: "departures", completed: 3, total: 6 },
      { step: "alerts", completed: 4, total: 6 },
      { step: "weather", completed: 5, total: 6 },
      { step: "saving", completed: 6, total: 6 },
    ]);
  });

  it("saves nothing when a download fails halfway", async () => {
    const { eventSource, transitSource, weatherSource } = createSources();
    transitSource.fetchAlerts.mockRejectedValue(new Error("offline"));
    const downloader = new EventPackageDownloader(
      eventSource,
      transitSource,
      weatherSource,
      () => NOW,
    );

    await expect(downloader.download("event-1")).rejects.toThrow("offline");

    expect(mockDb.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    expect(writeEventPackage).not.toHaveBeenCalled();
  });

  it("downloads departures only for stops near the stages", async () => {
    const { eventSource, transitSource, weatherSource } = createSources();
    const downloader = new EventPackageDownloader(
      eventSource,
      transitSource,
      weatherSource,
      () => NOW,
    );

    await downloader.download("event-1");

    expect(transitSource.fetchDepartures).toHaveBeenCalledTimes(1);
    expect(transitSource.fetchDepartures).toHaveBeenCalledWith(nearStop.id);
    expect(writeDepartures).toHaveBeenCalledTimes(1);
  });

  it("saves the weather forecast for the first stage", async () => {
    const { eventSource, transitSource, weatherSource } = createSources();
    const downloader = new EventPackageDownloader(
      eventSource,
      transitSource,
      weatherSource,
      () => NOW,
    );

    await downloader.download("event-1");

    expect(weatherSource.fetchForecast).toHaveBeenCalledWith(
      "event-1",
      eventPackage.stages[0]?.location,
    );
    expect(writeWeather).toHaveBeenCalledWith(mockTxn, "event-1", [forecast]);
  });

  it("skips the weather when the event has no stages", async () => {
    const { eventSource, transitSource, weatherSource } = createSources();
    eventSource.fetchEventPackage.mockResolvedValue({
      ...eventPackage,
      stages: [],
    });
    const downloader = new EventPackageDownloader(
      eventSource,
      transitSource,
      weatherSource,
      () => NOW,
    );

    await downloader.download("event-1");

    expect(weatherSource.fetchForecast).not.toHaveBeenCalled();
    expect(writeWeather).toHaveBeenCalledWith(mockTxn, "event-1", []);
  });
});
