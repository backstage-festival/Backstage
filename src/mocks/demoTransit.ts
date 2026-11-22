// TEMP: demo transit data until real transit data (#22/#32)
/**
 * Departures relative to the real clock, so Powrót shows the E08 states
 * whenever the app runs: „Wyjdź teraz”, a delay, „Nie zdążysz”, „Wyjdź o”.
 * The "timetable" scenario is E08-Nieaktualne: night buses by timetable,
 * data older than the TTL.
 */
import type { Coordinates, IsoDateString } from "@/domain/entities/common";
import type { Departure, TransitAlert } from "@/domain/entities/Transit";
import { calculateDistanceInMeters } from "@/domain/utils/distanceCalculator";

import { mockStops } from "./mockData";

export type MockTransitScenario = "live" | "timetable";

let scenario: MockTransitScenario = "live";

/** Switch from a dev menu: "timetable" shows E08-Nieaktualne on the next load. */
export function setMockTransitScenario(value: MockTransitScenario): void {
  scenario = value;
}

export function mockTransitScenario(): MockTransitScenario {
  return scenario;
}

/** Festival gate – the mocked GPS position (all stops within 500 m). */
export const mockGatePosition: Coordinates = { latitude: 54.3618, longitude: 18.6472 };

/** C05 walking speed (1.3 m/s), same as the view mapper. */
const WALK_SPEED_M_PER_S = 1.3;
const MINUTE_MS = 60_000;

const PLAC_SOLIDARNOSCI = 14701;
const STOCZNIA_SKM = 14702;
const PLAC_SOLIDARNOSCI_NIGHT = 14703;

function walkMs(stopId: number): number {
  const stop = mockStops.find((s) => s.id === stopId);
  if (stop === undefined) return 0;
  const meters = calculateDistanceInMeters(
    mockGatePosition.latitude,
    mockGatePosition.longitude,
    stop.location.latitude,
    stop.location.longitude,
  );
  return Math.round(meters / WALK_SPEED_M_PER_S) * 1000;
}

const iso = (ms: number): IsoDateString => new Date(ms).toISOString();

/** Builds the departures for the current scenario, relative to `nowMs` (load time). */
export function demoDepartures(nowMs: number = Date.now()): readonly Departure[] {
  if (scenario === "timetable") {
    const fetchedAt = iso(nowMs - 130 * MINUTE_MS); // „2 h 10 min temu”
    return [
      { stopId: PLAC_SOLIDARNOSCI_NIGHT, routeName: "N3", headsign: "Oliwa", departureAt: iso(nowMs + 8 * MINUTE_MS), delaySeconds: null, fetchedAt },
      { stopId: PLAC_SOLIDARNOSCI_NIGHT, routeName: "N8", headsign: "Chełm", departureAt: iso(nowMs + 36 * MINUTE_MS), delaySeconds: null, fetchedAt },
      { stopId: STOCZNIA_SKM, routeName: "SKM", headsign: "Gdynia Główna", departureAt: iso(nowMs + 14 * MINUTE_MS), delaySeconds: null, fetchedAt },
    ];
  }

  const fetchedAt = iso(nowMs - 5 * MINUTE_MS);
  const plac = walkMs(PLAC_SOLIDARNOSCI);
  const skm = walkMs(STOCZNIA_SKM);
  return [
    // Leave within the minute → „Wyjdź teraz”.
    { stopId: PLAC_SOLIDARNOSCI, routeName: "2", headsign: "Oliwa", departureAt: iso(nowMs + plac + 45_000), delaySeconds: 0, fetchedAt },
    // Later, 5 min late → „Opóźnienie · +5 min”.
    {
      stopId: PLAC_SOLIDARNOSCI,
      routeName: "6",
      headsign: "Łostowice Świętokrzyska",
      departureAt: iso(nowMs + 16 * MINUTE_MS),
      delaySeconds: 300,
      fetchedAt,
    },
    // Leaves before you could walk there → „Nie zdążysz”.
    { stopId: STOCZNIA_SKM, routeName: "SKM", headsign: "Gdynia Główna", departureAt: iso(nowMs + skm - MINUTE_MS), delaySeconds: 0, fetchedAt },
    // „Wyjdź o HH:MM”.
    { stopId: STOCZNIA_SKM, routeName: "SKM", headsign: "Gdynia Główna", departureAt: iso(nowMs + skm + 8 * MINUTE_MS), delaySeconds: 0, fetchedAt },
  ];
}

export function demoAlerts(nowMs: number = Date.now()): readonly TransitAlert[] {
  const fetchedAt = iso(nowMs - (scenario === "timetable" ? 130 : 5) * MINUTE_MS);
  return [
    {
      id: "alert-trams-2-6",
      title: "Tramwaje 2 i 6",
      body: "Objazd przez Wały Jagiellońskie do 23:30. Przystanek przeniesiony 50 m w stronę ul. Jana z Kolna.",
      validFrom: iso(nowMs - 60 * MINUTE_MS),
      validTo: iso(nowMs + 105 * MINUTE_MS),
      fetchedAt,
    },
  ];
}
