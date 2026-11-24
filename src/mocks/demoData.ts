// TEMP: demo data until real event data (#22/#32)
/**
 * mockData shifted to the real clock, so the app shows the board states
 * whenever it runs: Bursztyn Trio is on with 37 min left (E04), a message has
 * waited 40 min (stale, E06). Taken once per app start (module load).
 */
import type { Concert, FestivalEvent } from "@/domain/entities/Event";
import type { OutboxMessage } from "@/domain/entities/OutboxMessage";

import { mockClock, mockConcerts, mockEvent, mockMessages } from "./mockData";
import { demoAnchor, shiftIso } from "./relativeTime";

export const demoNow = demoAnchor();

const atPlanClock = (iso: string): string => shiftIso(iso, mockClock.plan, demoNow);
const atCrewClock = (iso: string): string => shiftIso(iso, mockClock.crew, demoNow);

export const demoEvent: FestivalEvent = {
  ...mockEvent,
  startsAt: atPlanClock(mockEvent.startsAt),
  endsAt: atPlanClock(mockEvent.endsAt),
  downloadedAt: mockEvent.downloadedAt === null ? null : atPlanClock(mockEvent.downloadedAt),
};

export const demoConcerts: readonly Concert[] = mockConcerts.map((concert) => ({
  ...concert,
  startsAt: atPlanClock(concert.startsAt),
  endsAt: atPlanClock(concert.endsAt),
}));

export const demoMessages: readonly OutboxMessage[] = mockMessages.map((message) => ({
  ...message,
  createdAt: atCrewClock(message.createdAt),
  nextAttemptAt: message.nextAttemptAt === null ? null : atCrewClock(message.nextAttemptAt),
  sentAt: message.sentAt === null ? null : atCrewClock(message.sentAt),
}));
