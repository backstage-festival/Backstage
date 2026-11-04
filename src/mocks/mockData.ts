// TEMP: mock data until #27
/**
 * Fictional „Stocznia Sound 2027” in Gdańsk (Young City / Stocznia Gdańska).
 * Typed with DOMAIN entities only – views get props through src/components/mappers.ts.
 * All times are Europe/Warsaw summer time (+02:00).
 */
import type { Concert, FestivalEvent, Stage } from "@/domain/entities/Event";
import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { Departure, Stop } from "@/domain/entities/Transit";
import type { User } from "@/domain/entities/User";

const EVENT_ID = "stocznia-sound-2027";

/** Fixed clocks so placeholders always show the same states. */
export const mockClock = {
  /** Plan: Bursztyn Trio is on, 37 min left. */
  plan: new Date("2027-07-02T20:03:00+02:00"),
  /** Powrót, live data. */
  return: new Date("2027-07-02T21:45:00+02:00"),
  /** Powrót, night buses by timetable only. */
  night: new Date("2027-07-02T23:50:00+02:00"),
  /** Ekipa. */
  crew: new Date("2027-07-02T21:50:00+02:00"),
} as const;

export const mockEvent: FestivalEvent = {
  id: EVENT_ID,
  name: "Stocznia Sound 2027",
  startsAt: "2027-07-02T14:00:00+02:00",
  endsAt: "2027-07-04T02:00:00+02:00",
  downloadedAt: "2027-07-02T14:05:00+02:00",
};

export const mockStages: Stage[] = [
  { id: "s1", eventId: EVENT_ID, name: "Główna", location: { latitude: 54.3618, longitude: 18.6469 } },
  { id: "s2", eventId: EVENT_ID, name: "Doki", location: { latitude: 54.3634, longitude: 18.6502 } },
  { id: "s3", eventId: EVENT_ID, name: "Namiot Elektro", location: { latitude: 54.3607, longitude: 18.6521 } },
];

export const mockConcerts: Concert[] = [
  {
    id: "c-biala-goraczka",
    eventId: EVENT_ID,
    stageId: "s1",
    artist: "Biała Gorączka",
    startsAt: "2027-07-02T17:15:00+02:00",
    endsAt: "2027-07-02T18:15:00+02:00",
  },
  {
    id: "c-bursztyn-trio",
    eventId: EVENT_ID,
    stageId: "s2",
    artist: "Bursztyn Trio",
    startsAt: "2027-07-02T19:40:00+02:00",
    endsAt: "2027-07-02T20:40:00+02:00",
  },
  {
    id: "c-wilga-i-fale",
    eventId: EVENT_ID,
    stageId: "s1",
    artist: "Wilga i Fale",
    startsAt: "2027-07-02T20:15:00+02:00",
    endsAt: "2027-07-02T21:30:00+02:00",
  },
  {
    id: "c-hanna-sieradz",
    eventId: EVENT_ID,
    stageId: "s2",
    artist: "Hanna Sieradz",
    startsAt: "2027-07-02T21:30:00+02:00",
    endsAt: "2027-07-02T22:30:00+02:00",
  },
  {
    id: "c-sodium-b2b-ostra",
    eventId: EVENT_ID,
    stageId: "s3",
    artist: "Sodium b2b Ostra",
    startsAt: "2027-07-02T21:30:00+02:00",
    endsAt: "2027-07-02T23:00:00+02:00",
  },
  {
    id: "c-mewy-noca",
    eventId: EVENT_ID,
    stageId: "s1",
    artist: "Mewy Nocą",
    startsAt: "2027-07-02T22:15:00+02:00",
    endsAt: "2027-07-02T23:30:00+02:00",
  },
];

/** Concert ids in „my plan” (mock of useScheduleStore). */
export const mockPlannedConcertIds: readonly string[] = ["c-wilga-i-fale", "c-hanna-sieradz", "c-mewy-noca"];

/** Serial printed on the NowPass. */
export const mockPassSerial = "0702-S2-03";

export const mockStops: Stop[] = [
  { id: 14701, name: "Plac Solidarności", location: { latitude: 54.3597, longitude: 18.6487 } },
  { id: 14702, name: "Stocznia SKM", location: { latitude: 54.3655, longitude: 18.6453 } },
  { id: 14703, name: "Plac Solidarności", location: { latitude: 54.3595, longitude: 18.6491 } },
];

/** Walking time from the festival gate to each stop (distance / 1.3 m/s). */
export const mockWalkSeconds: Readonly<Record<number, number>> = {
  14701: 231, // 300 m
  14702: 462, // 600 m
  14703: 231, // 300 m
};

const FETCHED_LIVE = "2027-07-02T21:40:00+02:00";
const FETCHED_TIMETABLE = "2027-07-02T14:05:00+02:00";

export const mockDepartures: Departure[] = [
  // Plac Solidarności – live
  {
    stopId: 14701,
    routeName: "2",
    headsign: "Oliwa",
    departureAt: "2027-07-02T21:49:00+02:00",
    delaySeconds: 0,
    fetchedAt: FETCHED_LIVE,
  },
  {
    stopId: 14701,
    routeName: "6",
    headsign: "Łostowice Świętokrzyska",
    departureAt: "2027-07-02T22:03:00+02:00",
    delaySeconds: 300,
    fetchedAt: FETCHED_LIVE,
  },
  // Stocznia SKM – live
  {
    stopId: 14702,
    routeName: "SKM",
    headsign: "Gdynia Główna",
    departureAt: "2027-07-02T21:52:00+02:00",
    delaySeconds: 0,
    fetchedAt: FETCHED_LIVE,
  },
  {
    stopId: 14702,
    routeName: "SKM",
    headsign: "Gdynia Główna",
    departureAt: "2027-07-02T22:07:00+02:00",
    delaySeconds: 0,
    fetchedAt: FETCHED_LIVE,
  },
  // Night buses – timetable only (no delay data)
  {
    stopId: 14703,
    routeName: "N3",
    headsign: "Oliwa",
    departureAt: "2027-07-02T23:58:00+02:00",
    delaySeconds: null,
    fetchedAt: FETCHED_TIMETABLE,
  },
  {
    stopId: 14703,
    routeName: "N8",
    headsign: "Chełm",
    departureAt: "2027-07-03T00:26:00+02:00",
    delaySeconds: null,
    fetchedAt: FETCHED_TIMETABLE,
  },
];

export const mockCurrentUserId = "u-jakub";

export const mockUsers: User[] = [
  { id: "u-jakub", login: "Jakub", passwordHash: "mock", createdAt: "2027-06-01T10:00:00+02:00" },
  { id: "u-kuba", login: "Kuba", passwordHash: "mock", createdAt: "2027-06-01T10:00:00+02:00" },
  { id: "u-ola", login: "Ola", passwordHash: "mock", createdAt: "2027-06-01T10:00:00+02:00" },
];

const CREW_ID = "crew-mewy";

export const mockMessages: OutboxMessage[] = [
  {
    id: "m-1",
    crewId: CREW_ID,
    authorId: "u-kuba",
    body: "Jesteśmy pod Doki, lewa strona, przy dźwigu.",
    status: "sent",
    attempts: 1,
    createdAt: "2027-07-02T21:02:00+02:00",
    nextAttemptAt: null,
    sentAt: "2027-07-02T21:02:00+02:00",
  },
  {
    id: "m-2",
    crewId: CREW_ID,
    authorId: mockCurrentUserId,
    body: "Ok, za chwilę będę.",
    status: "sent",
    attempts: 1,
    createdAt: "2027-07-02T21:04:00+02:00",
    nextAttemptAt: null,
    sentAt: "2027-07-02T21:05:00+02:00",
  },
  {
    // stale: 40 min in the queue
    id: "m-3",
    crewId: CREW_ID,
    authorId: mockCurrentUserId,
    body: "Jestem pod S2 za 5 min.",
    status: "queued",
    attempts: 2,
    createdAt: "2027-07-02T21:10:00+02:00",
    nextAttemptAt: "2027-07-02T21:55:00+02:00",
    sentAt: null,
  },
  {
    // failed: tried, no further attempt scheduled
    id: "m-4",
    crewId: CREW_ID,
    authorId: mockCurrentUserId,
    body: "Jestem pod S2 za 5 min.",
    status: "queued",
    attempts: 3,
    createdAt: "2027-07-02T21:45:00+02:00",
    nextAttemptAt: null,
    sentAt: null,
  },
  {
    // sending (id listed in mockSendingIds)
    id: "m-5",
    crewId: CREW_ID,
    authorId: mockCurrentUserId,
    body: "Idę po bluzę do namiotu, wracam 22:30.",
    status: "queued",
    attempts: 0,
    createdAt: "2027-07-02T21:47:00+02:00",
    nextAttemptAt: "2027-07-02T21:50:00+02:00",
    sentAt: null,
  },
  {
    // queued
    id: "m-6",
    crewId: CREW_ID,
    authorId: mockCurrentUserId,
    body: "Idę po bluzę do namiotu, wracam 22:30.",
    status: "queued",
    attempts: 0,
    createdAt: "2027-07-02T21:48:00+02:00",
    nextAttemptAt: "2027-07-02T21:51:00+02:00",
    sentAt: null,
  },
];

/** Messages the gateway is pushing right now (mock of useConnectionStore). */
export const mockSendingIds: ReadonlySet<string> = new Set(["m-5"]);
