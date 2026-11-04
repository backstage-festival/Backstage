/**
 * Pure view mappers: domain entity → component props. No React, no stores.
 * Callbacks (onPress, onTogglePlan, …) are added by the screen.
 */
import type { Concert, Stage } from "@/domain/entities/Event";
import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { Departure } from "@/domain/entities/Transit";
import { strings } from "@/strings";
import type {
  DepartureRowProps,
  DepartureState,
  MessageBubbleProps,
  MessageStatus,
  NowPassProps,
  PerformanceCardProps,
  StageId,
  TransitKind,
} from "@/types/components";

const MINUTE_MS = 60_000;
/** C05: walking speed used for distance ↔ time. */
export const WALK_SPEED_M_PER_S = 1.3;
/** Leave within the next minute → „Wyjdź teraz”. */
const LEAVE_NOW_WINDOW_MS = MINUTE_MS;
/** Leave within 15 minutes → „Wyjdź o HH:MM”. */
const LEAVE_AT_WINDOW_MS = 15 * MINUTE_MS;

/* ------------------------------------------------------------------ */
/* Time                                                                 */
/* ------------------------------------------------------------------ */

const warsawTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO string or Date → „21:49” in Europe/Warsaw. */
export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return warsawTime.format(date);
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

function wholeMinutes(diffMs: number): number {
  return Math.max(0, Math.floor(diffMs / MINUTE_MS));
}

/* ------------------------------------------------------------------ */
/* Plan                                                                 */
/* ------------------------------------------------------------------ */

/** Stage.id → UI stage code (S1–S3). Provided by the caller (mocks / event store). */
export type StageCodes = Readonly<Record<string, StageId>>;

/**
 * Safe fallback for a stage missing from stageCodes: never throw while rendering
 * a list. S1 keeps the layout valid; the stage name is still shown and read.
 */
export const FALLBACK_STAGE_ID: StageId = "s1";

export function stageIdOf(stage: Stage, stageCodes: StageCodes): StageId {
  return stageCodes[stage.id] ?? FALLBACK_STAGE_ID;
}

function stageNumberOf(stage: Stage, stageCodes: StageCodes): number {
  return Number(stageIdOf(stage, stageCodes).slice(1));
}

/** Two concerts overlap when one starts before the other ends. */
export function overlaps(a: Concert, b: Concert): boolean {
  return a.id !== b.id && ms(a.startsAt) < ms(b.endsAt) && ms(b.startsAt) < ms(a.endsAt);
}

/** First planned concert that overlaps `concert` (selector logic, not server). */
export function findConflict(concert: Concert, planned: readonly Concert[]): Concert | undefined {
  return planned.find((other) => overlaps(concert, other));
}

export type PerformanceCardData = Omit<PerformanceCardProps, "onPress" | "onTogglePlan" | "testID">;

export interface PerformanceCardOptions {
  inPlan: boolean;
  stageCodes: StageCodes;
  conflictWith?: { concert: Concert; stage: Stage };
  now?: Date;
}

export function toPerformanceCardProps(
  concert: Concert,
  stage: Stage,
  { inPlan, stageCodes, conflictWith, now = new Date() }: PerformanceCardOptions,
): PerformanceCardData {
  const base = {
    id: concert.id,
    artist: concert.artist,
    stage: stageIdOf(stage, stageCodes),
    stageName: stage.name,
    start: formatTime(concert.startsAt),
    end: formatTime(concert.endsAt),
  };

  if (now.getTime() >= ms(concert.endsAt)) return { ...base, state: "played" };
  if (inPlan && conflictWith) {
    return {
      ...base,
      state: "conflict",
      statusLine: strings.plan.conflictLine(
        stageNumberOf(conflictWith.stage, stageCodes),
        formatTime(conflictWith.concert.startsAt),
      ),
    };
  }
  return { ...base, state: inPlan ? "inPlan" : "default" };
}

export type NowPassData = Omit<NowPassProps, "onPress">;

export function toNowPassProps(
  concert: Concert,
  stage: Stage,
  options: {
    inPlan: boolean;
    serial: string;
    accentSuppressed: boolean;
    stageCodes: StageCodes;
    alsoNow?: string;
    now?: Date;
  },
): NowPassData {
  const now = (options.now ?? new Date()).getTime();
  const start = ms(concert.startsAt);
  const end = ms(concert.endsAt);
  const duration = Math.max(1, end - start);
  return {
    id: concert.id,
    artist: concert.artist,
    stage: stageIdOf(stage, options.stageCodes),
    stageName: stage.name,
    range: strings.plan.timeRange(formatTime(concert.startsAt), formatTime(concert.endsAt)),
    remainingMin: wholeMinutes(end - now),
    progress: Math.min(1, Math.max(0, (now - start) / duration)),
    serial: options.serial,
    inPlan: options.inPlan,
    accentSuppressed: options.accentSuppressed,
    ...(options.alsoNow ? { alsoNow: options.alsoNow } : null),
  };
}

/* ------------------------------------------------------------------ */
/* Transit                                                              */
/* ------------------------------------------------------------------ */

/**
 * ASSUMPTION (not in the domain): N… = night, SKM = skm,
 * numeric line ≤ 12 = tram, everything else = bus.
 */
export function transitKindOf(routeName: string): TransitKind {
  const name = routeName.trim().toUpperCase();
  if (name.startsWith("SKM")) return "skm";
  if (/^N\d*/.test(name)) return "night";
  if (/^\d+$/.test(name) && Number(name) <= 12) return "tram";
  return "bus";
}

export function walkDistanceM(walkSeconds: number): number {
  return Math.round((walkSeconds * WALK_SPEED_M_PER_S) / 10) * 10;
}

/** StopCard meta: „300 m · 4 min”. */
export function walkMeta(walkSeconds: number): string {
  return strings.transit.meta(walkDistanceM(walkSeconds), Math.ceil(walkSeconds / 60));
}

export function toDepartureRowProps(departure: Departure, walkSeconds: number, now: Date = new Date()): DepartureRowProps {
  const kind = transitKindOf(departure.routeName);
  const live = departure.delaySeconds !== null;
  const delaySeconds = departure.delaySeconds ?? 0;
  const departsAt = ms(departure.departureAt) + delaySeconds * 1000;
  const leaveBy = departsAt - walkSeconds * 1000;
  const untilLeave = leaveBy - now.getTime();
  const minutes = wholeMinutes(departsAt - now.getTime());

  let state: DepartureState;
  if (untilLeave < 0) state = "missed";
  else if (untilLeave <= LEAVE_NOW_WINDOW_MS) state = "leaveNow";
  else if (untilLeave <= LEAVE_AT_WINDOW_MS) state = "leaveAt";
  else state = "later";

  let note: string | undefined;
  if (!live) {
    note = `${strings.transit.kind[kind]}${strings.common.separator}${walkDistanceM(walkSeconds)} m`;
  } else if (state === "leaveAt") {
    note = strings.transit.leaveAt(formatTime(new Date(leaveBy)));
  } else if (state === "later" && delaySeconds >= 60) {
    note = strings.transit.delay(Math.round(delaySeconds / 60));
  }

  return {
    line: departure.routeName,
    kind,
    direction: departure.headsign,
    time: formatTime(new Date(departsAt)),
    inMinutes: live ? strings.transit.minutes(minutes) : strings.transit.approxMinutes(minutes),
    state,
    freshness: live ? "live" : "stale",
    ...(note ? { note } : null),
  };
}

/* ------------------------------------------------------------------ */
/* Crew                                                                 */
/* ------------------------------------------------------------------ */

export type MessageBubbleData = Omit<MessageBubbleProps, "onCancel" | "onSendAnyway" | "onDelete" | "testID">;

export interface MessageBubbleOptions {
  currentUserId: string;
  now?: Date;
  /** C04: after this many minutes in the queue the message is stale (default 20). */
  // TEMP: replace with domain rule from #21 (Domain & QA)
  staleAfterMin?: number;
  /** authorId → display name (OutboxMessage has only authorId). */
  authorNames?: Readonly<Record<string, string>>;
  /** Ids the gateway is sending right now (transient, not stored). */
  sendingIds?: ReadonlySet<string>;
}

/**
 * Domain stores only queued | sent. UI statuses are derived:
 * - failed: queued, already attempted, no further attempt scheduled,
 * - stale: queued for ≥ staleAfterMin,
 * - sending: id in sendingIds.
 */
export function messageStatusOf(
  message: OutboxMessage,
  now: Date,
  staleAfterMin: number,
  sendingIds?: ReadonlySet<string>,
): MessageStatus {
  if (message.status === "sent") return "sent";
  // TEMP: replace with domain rule from #21 (Domain & QA)
  if (message.attempts > 0 && message.nextAttemptAt === null) return "failed";
  // TEMP: replace with domain rule from #21 (Domain & QA)
  if (now.getTime() - ms(message.createdAt) >= staleAfterMin * MINUTE_MS) return "stale";
  if (sendingIds?.has(message.id)) return "sending";
  return "queued";
}

export function toMessageBubbleProps(
  message: OutboxMessage,
  { currentUserId, now = new Date(), staleAfterMin = 20, authorNames, sendingIds }: MessageBubbleOptions,
): MessageBubbleData {
  const own = message.authorId === currentUserId;

  if (!own) {
    return {
      id: message.id,
      author: "crew",
      senderName: authorNames?.[message.authorId] ?? "",
      time: formatTime(message.sentAt ?? message.createdAt),
      text: message.body,
    };
  }

  const status = messageStatusOf(message, now, staleAfterMin, sendingIds);
  const time = formatTime(status === "sent" ? (message.sentAt ?? message.createdAt) : message.createdAt);

  let statusLabel: string;
  switch (status) {
    case "queued":
      statusLabel = strings.message.status.queued(time);
      break;
    case "sending":
      statusLabel = strings.message.status.sending;
      break;
    case "sent":
      statusLabel = strings.message.status.sent(time);
      break;
    case "stale":
      statusLabel = strings.message.status.stale(wholeMinutes(now.getTime() - ms(message.createdAt)));
      break;
    case "failed":
      statusLabel = strings.message.status.failed;
      break;
  }

  return { id: message.id, author: "me", time, text: message.body, status, statusLabel };
}
