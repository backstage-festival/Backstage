// TEMP: mock deps until #32 (DI)
/**
 * In-memory implementations of the store dependencies, seeded from mockData.
 * Real use cases run on top of in-memory repositories, so conflicts, validation
 * and the outbox behave like in production. Every call waits ~300 ms and
 * `failNextWrite()` makes the next write throw – this shows the optimistic
 * rollback on a phone and during the defence.
 */
import type { CheckIn, ScheduleItem } from "@/domain/entities/Schedule";
import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { User } from "@/domain/entities/User";
import type { Coordinates, Unsubscribe } from "@/domain/entities/common";
import { DomainError } from "@/domain/errors/DomainError";
import { TooFarFromStageError } from "@/domain/errors/TooFarFromStageError";
import { checkGeofence } from "@/domain/utils/geofence";
import type { IEventRepository } from "@/domain/repositories/IEventRepository";
import type { ILocationService } from "@/domain/repositories/ILocationService";
import type { IIdGenerator } from "@/domain/repositories/IIdGenerator";
import type { IMessageGateway } from "@/domain/repositories/IMessageGateway";
import type { INetworkService } from "@/domain/repositories/INetworkService";
import type { IOutboxRepository } from "@/domain/repositories/IOutboxRepository";
import type { IScheduleRepository } from "@/domain/repositories/IScheduleRepository";
import type { ITransitRepository } from "@/domain/repositories/ITransitRepository";
import type { AuthStoreDeps } from "@/store/authStore";
import type { CheckInStoreDeps } from "@/store/checkInStore";
import type { LineupStoreDeps } from "@/store/lineupStore";
import type { MessageStoreDeps } from "@/store/messageStore";
import type { SavedPlace } from "@/domain/entities/SavedPlace";
import type { ISavedPlaceRepository } from "@/domain/repositories/ISavedPlaceRepository";
import type { PlacesStoreDeps } from "@/store/placesStore";
import type { ScheduleStoreDeps } from "@/store/scheduleStore";
import {
  type AccessibilitySettings,
  DEFAULT_SETTINGS,
  type SettingsStoreDeps,
  withSetting,
} from "@/store/settingsStore";
import type { TransitStoreDeps } from "@/store/transitStore";
import { AddToScheduleUseCase } from "@/use-cases/AddToScheduleUseCase";
import { GetNearbyStopsUseCase } from "@/use-cases/GetNearbyStopsUseCase";
import type { CheckInResult } from "@/use-cases/CheckInUseCase";
import { QueueMessageUseCase } from "@/use-cases/QueueMessageUseCase";
import { RetryMessageUseCase } from "@/use-cases/RetryMessageUseCase";
import { SavePlaceUseCase } from "@/use-cases/SavePlaceUseCase";
import { SyncOutboxUseCase } from "@/use-cases/SyncOutboxUseCase";

import { demoConcerts, demoEvent, demoMessages } from "./demoData";
import { mockSavedPlaces } from "./demoPlaces";
import { demoAlerts, demoDepartures, mockGatePosition } from "./demoTransit";
import { mockCurrentUserId, mockPlannedConcertIds, mockStages, mockStops, mockUsers } from "./mockData";

export const MOCK_DELAY_MS = 300;

const delay = (ms: number = MOCK_DELAY_MS): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

let failNext = false;

/** Makes the next mocked write reject once (demo of the optimistic rollback). */
export function failNextWrite(): void {
  failNext = true;
}

/** Waits like a real device and throws if failNextWrite() was armed. */
async function write(): Promise<void> {
  await delay();
  if (failNext) {
    failNext = false;
    throw new Error("Mock write failed (failNextWrite).");
  }
}

let failNextRead = false;

/** Makes the next mocked read (line-up, transit) reject once – demo of the error state. */
export function failNextLoad(): void {
  failNextRead = true;
}

/** Waits like a real device and throws if failNextLoad() was armed. */
async function read(): Promise<void> {
  await delay();
  if (failNextRead) {
    failNextRead = false;
    throw new Error("Mock read failed (failNextLoad).");
  }
}

let idCounter = 0;
const idGenerator: IIdGenerator = {
  generate: () => {
    idCounter += 1;
    return `mock-${idCounter}`;
  },
};

/* ------------------------------------------------------------------ */
/* In-memory data                                                       */
/* ------------------------------------------------------------------ */

let scheduleItems: ScheduleItem[] = mockPlannedConcertIds.map((concertId) => ({
  userId: mockCurrentUserId,
  concertId,
  addedAt: "2027-06-20T12:00:00+02:00",
}));
let outbox: OutboxMessage[] = [...demoMessages];
let checkIns: CheckIn[] = [];
const users: User[] = [...mockUsers];

const eventRepository: IEventRepository = {
  getCurrentEvent: async () => demoEvent,
  getStages: async (eventId) => mockStages.filter((s) => s.eventId === eventId),
  getConcerts: async (eventId) =>
    demoConcerts.filter((c) => c.eventId === eventId),
  getPoisInBounds: async () => [],
  saveEventPackage: async () => undefined,
};

const scheduleRepository: IScheduleRepository = {
  getForUser: async (userId) => {
    await delay();
    return scheduleItems.filter((item) => item.userId === userId);
  },
  add: async (item) => {
    await write();
    scheduleItems = [...scheduleItems, item];
  },
  remove: async (userId, concertId) => {
    await write();
    scheduleItems = scheduleItems.filter(
      (item) => !(item.userId === userId && item.concertId === concertId),
    );
  },
};

const updateMessage = (
  id: string,
  change: (message: OutboxMessage) => OutboxMessage,
): void => {
  outbox = outbox.map((message) =>
    message.id === id ? change(message) : message,
  );
};

const outboxRepository: IOutboxRepository = {
  enqueue: async (message) => {
    await write();
    outbox = [...outbox, message];
  },
  getQueued: async () => outbox.filter((m) => m.status === "queued"),
  getForCrew: async (crewId) => {
    await delay();
    return outbox.filter((m) => m.crewId === crewId);
  },
  markSent: async (id, sentAt) => {
    updateMessage(id, (m) => ({ ...m, status: "sent", sentAt }));
  },
  markFailed: async (id, attempts, nextAttemptAt) => {
    updateMessage(id, (m) => ({ ...m, attempts, nextAttemptAt }));
  },
  resetAttempts: async (id) => {
    await write();
    updateMessage(id, (m) => ({ ...m, attempts: 0, nextAttemptAt: null }));
  },
};

/* ------------------------------------------------------------------ */
/* Network                                                              */
/* ------------------------------------------------------------------ */

let online = true;
const networkListeners = new Set<(online: boolean) => void>();

/** Flip the mock connection from a dev menu to demo offline mode. */
export function setMockOnline(value: boolean): void {
  if (online === value) return;
  online = value;
  for (const listener of networkListeners) listener(value);
}

export const mockNetworkService: INetworkService = {
  isOnline: async () => online,
  onChange: (listener): Unsubscribe => {
    networkListeners.add(listener);
    return () => {
      networkListeners.delete(listener);
    };
  },
};

const messageGateway: IMessageGateway = {
  send: async () => {
    await delay();
  },
  fetchForCrew: async () => [],
};

/* ------------------------------------------------------------------ */
/* Location                                                             */
/* ------------------------------------------------------------------ */

let locationAllowed = true;

/** Flip the mock permission from a dev menu to demo the „Otwórz ustawienia” state. */
export function setMockLocationAllowed(value: boolean): void {
  locationAllowed = value;
}

/** Phone heading in the mock: north. */
const MOCK_HEADING_DEG = 0;

/** TEMP until #32: where the mock phone stands – the festival gate or next to a stage. */
export type MockPositionTarget = "gate" | { readonly stageId: string };

/** „Next to a stage” = this many metres north of it (inside the 50 m check-in radius). */
export const MOCK_NEAR_STAGE_M = 30;
const METERS_PER_DEGREE_LATITUDE = 111_320;

let positionTarget: MockPositionTarget = "gate";
const positionListeners = new Set<(position: Coordinates) => void>();

function positionOf(target: MockPositionTarget): Coordinates {
  if (target === "gate") return mockGatePosition;
  const stage = mockStages.find((s) => s.id === target.stageId);
  if (stage === undefined) return mockGatePosition;
  return {
    latitude: stage.location.latitude + MOCK_NEAR_STAGE_M / METERS_PER_DEGREE_LATITUDE,
    longitude: stage.location.longitude,
  };
}

/** Current mock position; null without the permission. */
function currentPosition(): Coordinates | null {
  return locationAllowed ? positionOf(positionTarget) : null;
}

export function getMockPosition(): MockPositionTarget {
  return positionTarget;
}

/**
 * TEMP until #32: moves the mock phone (dev switch on the Plan). The default
 * is the gate, so S07 / 07b look like on their boards. Every watcher gets the
 * new position at once.
 */
export function setMockPosition(target: MockPositionTarget): void {
  positionTarget = target;
  const position = currentPosition();
  if (position === null) return;
  for (const listener of [...positionListeners]) listener(position);
}

/**
 * GPS of a phone that stands still until setMockPosition() moves it. A new
 * watcher gets the current position right after subscribing.
 */
export const mockLocationService: ILocationService = {
  requestPermissions: async () => locationAllowed,
  getCurrentPosition: async () => currentPosition(),
  watchPosition: async (onChange) => {
    positionListeners.add(onChange);
    const timer = setTimeout(() => {
      const position = currentPosition();
      if (position !== null) onChange(position);
    }, 0);
    return () => {
      clearTimeout(timer);
      positionListeners.delete(onChange);
    };
  },
  watchHeading: async (onChange) => {
    const timer = setTimeout(() => onChange(MOCK_HEADING_DEG), MOCK_DELAY_MS);
    return () => clearTimeout(timer);
  },
};
const locationService = mockLocationService;

/* ------------------------------------------------------------------ */
/* Store deps                                                           */
/* ------------------------------------------------------------------ */

export const mockScheduleDeps: ScheduleStoreDeps = {
  addToSchedule: new AddToScheduleUseCase(eventRepository, scheduleRepository),
  loadSchedule: (userId) => scheduleRepository.getForUser(userId),
  removeFromSchedule: (userId, concertId) =>
    scheduleRepository.remove(userId, concertId),
};

export const mockMessageDeps: MessageStoreDeps = {
  queueMessage: new QueueMessageUseCase(outboxRepository, idGenerator),
  retryMessage: new RetryMessageUseCase(outboxRepository),
  syncOutbox: new SyncOutboxUseCase(
    outboxRepository,
    messageGateway,
    mockNetworkService,
  ),
  loadMessages: (crewId) => outboxRepository.getForCrew(crewId),
};

/**
 * TEMP until #32. Like CheckInUseCase: no GPS → LOCATION_UNAVAILABLE, outside
 * the geofence of the concert's stage → TooFarFromStageError(distance), and the
 * write can fail (failNextWrite) → the store rolls back.
 * The time window (isCheckInOpen) is skipped on purpose: the demo clock only
 * shifts the line-up roughly to „now”, and the screen already blocks check-in
 * outside the window – so the mock and its tests never depend on the wall clock.
 */
export const mockCheckInDeps: CheckInStoreDeps = {
  checkIn: {
    execute: async ({ userId, concertId }): Promise<CheckInResult> => {
      const concert = demoConcerts.find((c) => c.id === concertId);
      if (concert === undefined) {
        throw new DomainError("CONCERT_NOT_FOUND", `Concert ${concertId} not found.`);
      }
      const stage = mockStages.find((s) => s.id === concert.stageId);
      if (stage === undefined) {
        throw new DomainError("STAGE_NOT_FOUND", `Stage ${concert.stageId} not found.`);
      }
      if (checkIns.some((c) => c.userId === userId && c.concertId === concertId)) {
        return { status: "already_checked_in" };
      }
      const position = await locationService.getCurrentPosition();
      if (position === null) {
        throw new DomainError("LOCATION_UNAVAILABLE", "Current location is unavailable.");
      }
      const { isInside, distanceMeters } = checkGeofence(position, stage.location);
      if (!isInside) throw new TooFarFromStageError(distanceMeters);
      await write();
      const checkIn: CheckIn = {
        id: idGenerator.generate(),
        userId,
        concertId,
        createdAt: new Date().toISOString(),
      };
      checkIns = [...checkIns, checkIn];
      return { status: "checked_in", checkIn, distanceMeters };
    },
  },
  loadCheckIns: async (userId) => {
    await delay();
    return checkIns.filter((c) => c.userId === userId);
  },
};

/** Any password works for existing mock users – there is no hash check here. */
export const mockAuthDeps: AuthStoreDeps = {
  login: async (login) => {
    await delay();
    const user = users.find((u) => u.login === login);
    if (user === undefined) {
      throw new DomainError("INVALID_CREDENTIALS", "Invalid login or password.");
    }
    return user;
  },
  register: async (login) => {
    await write();
    if (users.some((u) => u.login === login)) {
      throw new DomainError("LOGIN_TAKEN", `Login ${login} is taken.`);
    }
    const user: User = {
      id: idGenerator.generate(),
      login,
      passwordHash: "mock",
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return user;
  },
};

export const mockLineupDeps: LineupStoreDeps = {
  loadLineup: async (eventId) => {
    await read();
    const [event, stages, concerts] = await Promise.all([
      eventRepository.getCurrentEvent(),
      eventRepository.getStages(eventId),
      eventRepository.getConcerts(eventId),
    ]);
    return { event: event?.id === eventId ? event : null, stages, concerts };
  },
};

/* ------------------------------------------------------------------ */
/* Transit                                                              */
/* ------------------------------------------------------------------ */

const transitRepository: ITransitRepository = {
  getStopsInBounds: async (bounds) =>
    mockStops.filter(
      (stop) =>
        stop.location.latitude >= bounds.minLatitude &&
        stop.location.latitude <= bounds.maxLatitude &&
        stop.location.longitude >= bounds.minLongitude &&
        stop.location.longitude <= bounds.maxLongitude,
    ),
  saveStops: async () => undefined,
  getDepartures: async (stopId) => demoDepartures().filter((d) => d.stopId === stopId),
  saveDepartures: async () => undefined,
  getAlerts: async () => demoAlerts(),
  saveAlerts: async () => undefined,
};

export const mockTransitDeps: TransitStoreDeps = {
  getNearbyStops: new GetNearbyStopsUseCase(transitRepository, locationService),
  loadDepartures: async (stopIds) => {
    await read();
    const lists = await Promise.all(stopIds.map((id) => transitRepository.getDepartures(id)));
    return lists.flat();
  },
  loadAlerts: () => transitRepository.getAlerts(),
};

/* ------------------------------------------------------------------ */
/* Settings (S10)                                                       */
/* ------------------------------------------------------------------ */

const settingsByUser = new Map<string, AccessibilitySettings>();

/**
 * In-memory user_settings: no row until the first write (load returns null).
 * A write changes one key only, like an UPDATE of one column.
 */
export const mockSettingsDeps: SettingsStoreDeps = {
  loadSettings: async (userId) => {
    await delay();
    return settingsByUser.get(userId) ?? null;
  },
  saveSetting: async (userId, key, value) => {
    await write();
    settingsByUser.set(userId, withSetting(settingsByUser.get(userId) ?? DEFAULT_SETTINGS, key, value));
  },
};

/* ------------------------------------------------------------------ */
/* Saved places (S07)                                                   */
/* ------------------------------------------------------------------ */

let savedPlaces: SavedPlace[] = [...mockSavedPlaces];

const savedPlaceRepository: ISavedPlaceRepository = {
  getForUser: async (userId) => {
    await delay();
    return savedPlaces
      .filter((place) => place.userId === userId)
      .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  },
  // Upsert by id, like INSERT OR REPLACE.
  save: async (place) => {
    await write();
    savedPlaces = [...savedPlaces.filter((p) => p.id !== place.id), place];
  },
  remove: async (id) => {
    await write();
    savedPlaces = savedPlaces.filter((p) => p.id !== id);
  },
};

export const mockPlacesDeps: PlacesStoreDeps = {
  savePlace: new SavePlaceUseCase(savedPlaceRepository, mockLocationService, idGenerator),
  location: mockLocationService,
  loadPlaces: (userId) => savedPlaceRepository.getForUser(userId),
  removePlace: (placeId) => savedPlaceRepository.remove(placeId),
  renamePlace: (place) => savedPlaceRepository.save(place),
};
