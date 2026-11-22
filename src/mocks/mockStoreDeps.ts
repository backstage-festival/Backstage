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
import type { Unsubscribe } from "@/domain/entities/common";
import { DomainError } from "@/domain/errors/DomainError";
import type { IEventRepository } from "@/domain/repositories/IEventRepository";
import type { IIdGenerator } from "@/domain/repositories/IIdGenerator";
import type { IMessageGateway } from "@/domain/repositories/IMessageGateway";
import type { INetworkService } from "@/domain/repositories/INetworkService";
import type { IOutboxRepository } from "@/domain/repositories/IOutboxRepository";
import type { IScheduleRepository } from "@/domain/repositories/IScheduleRepository";
import type { AuthStoreDeps } from "@/store/authStore";
import type { CheckInStoreDeps } from "@/store/checkInStore";
import type { LineupStoreDeps } from "@/store/lineupStore";
import type { MessageStoreDeps } from "@/store/messageStore";
import type { ScheduleStoreDeps } from "@/store/scheduleStore";
import { AddToScheduleUseCase } from "@/use-cases/AddToScheduleUseCase";
import type { CheckInResult } from "@/use-cases/CheckInUseCase";
import { QueueMessageUseCase } from "@/use-cases/QueueMessageUseCase";
import { RetryMessageUseCase } from "@/use-cases/RetryMessageUseCase";
import { SyncOutboxUseCase } from "@/use-cases/SyncOutboxUseCase";

import { demoConcerts, demoEvent, demoMessages } from "./demoData";
import { mockCurrentUserId, mockPlannedConcertIds, mockStages, mockUsers } from "./mockData";

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
 * The real CheckInUseCase needs GPS and the festival clock (2027), so the mock
 * skips the geofence and the time window and always lets the user in.
 */
export const mockCheckInDeps: CheckInStoreDeps = {
  checkIn: {
    execute: async ({ userId, concertId }): Promise<CheckInResult> => {
      if (checkIns.some((c) => c.userId === userId && c.concertId === concertId)) {
        return { status: "already_checked_in" };
      }
      await write();
      const checkIn: CheckIn = {
        id: idGenerator.generate(),
        userId,
        concertId,
        createdAt: new Date().toISOString(),
      };
      checkIns = [...checkIns, checkIn];
      return { status: "checked_in", checkIn, distanceMeters: 0 };
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
