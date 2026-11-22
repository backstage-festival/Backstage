/**
 * Pure Plan logic: festival days, filters, TERAZ / DALEJ / ZAGRANE rows and
 * their fixed heights. No hooks and no stores – usePlanScreen feeds it.
 */
import { PLAN_NOTE_HEIGHT } from "@/components/PlanNoteRow";
import { PLAYED_ROW_HEIGHT } from "@/components/PlayedRow";
import { performanceCardHeight } from "@/components/PerformanceCard";
import { SECTION_HEADER_HEIGHT } from "@/components/SectionHeader";
import {
  formatTime,
  type NowPassData,
  type PerformanceCardData,
  type StageCodes,
  toNowPassProps,
  toPerformanceCardProps,
} from "@/components/mappers";
import type { Concert, FestivalEvent, Stage } from "@/domain/entities/Event";
import { DomainError } from "@/domain/errors/DomainError";
import { findScheduleConflicts } from "@/domain/utils/scheduleConflict";
import { strings } from "@/strings";
import type { StageId } from "@/types/components";

/* ------------------------------------------------------------------ */
/* Days                                                                 */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60_000;
const HOUR_MS = 60 * 60_000;
/**
 * ASSUMPTION: a festival day runs until 06:00, so a concert at 00:30 belongs
 * to the evening before (it is listed under „Pt”, not „Sob”).
 */
export const FESTIVAL_DAY_START_HOUR = 6;
const STAGE_IDS: readonly StageId[] = ["s1", "s2", "s3"];

/** ISO → „2027-07-02” (calendar day in Europe/Warsaw). */
const warsawDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day; with `startHour` the day starts that many hours after midnight. */
export function dayKeyOf(value: string | Date, startHour = 0): string {
  const ms = typeof value === "string" ? Date.parse(value) : value.getTime();
  return warsawDay.format(new Date(ms - startHour * HOUR_MS));
}

/** Festival day of a moment (until 06:00 it is still the previous day). */
export function festivalDayOf(value: string | Date): string {
  return dayKeyOf(value, FESTIVAL_DAY_START_HOUR);
}

/** „2027-07-02” → „Pt 2.07”. */
export function dayLabel(dayKey: string): string {
  const [year = 0, month = 1, day = 1] = dayKey.split("-").map(Number);
  const weekday = strings.planScreen.weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
  return strings.planScreen.day(weekday, day, String(month).padStart(2, "0"));
}

/** Festival days (start → end), plus any day that has a concert. */
export function festivalDays(event: FestivalEvent | null, concerts: readonly Concert[]): readonly string[] {
  const days = new Set<string>();
  if (event !== null) {
    const start = Date.parse(event.startsAt);
    const end = Date.parse(event.endsAt);
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      for (let t = start; t < end; t += DAY_MS) days.add(festivalDayOf(new Date(t)));
      days.add(festivalDayOf(new Date(end)));
    }
  }
  for (const concert of concerts) days.add(festivalDayOf(concert.startsAt));
  return [...days].sort();
}

/** Today when the festival is on, otherwise the next festival day (or the first). */
export function defaultDay(days: readonly string[], now: Date): string | null {
  const today = festivalDayOf(now);
  return days.find((day) => day >= today) ?? days[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Stages and conflicts                                                 */
/* ------------------------------------------------------------------ */

/** Stage.id → S1–S3 by line-up order (the boards show three stages). */
export function stageCodesOf(stages: readonly Stage[]): StageCodes {
  const codes: Record<string, StageId> = {};
  stages.forEach((stage, index) => {
    const code = STAGE_IDS[index];
    if (code !== undefined) codes[stage.id] = code;
  });
  return codes;
}

/** First planned concert overlapping `concert` (domain rule). Bad data never throws while rendering. */
export function firstConflict(concert: Concert, planned: readonly Concert[]): Concert | undefined {
  try {
    return findScheduleConflicts(concert, planned)[0];
  } catch (error) {
    if (error instanceof DomainError) return undefined;
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Rows                                                                 */
/* ------------------------------------------------------------------ */

export type PlanScope = "all" | "mine";

export interface PlanFilters {
  /** null = default day (today or the next festival day). */
  readonly day: string | null;
  readonly scope: PlanScope;
  /** Empty = all stages. */
  readonly stages: readonly StageId[];
}

export interface PlanNote {
  readonly concertId: string | null;
  readonly label: string;
  readonly tone: "warning" | "error";
  readonly allowConflict: boolean;
}

export type PlanRow =
  | { readonly type: "header"; readonly key: string; readonly label: string }
  | { readonly type: "perf"; readonly key: string; readonly card: PerformanceCardData }
  | { readonly type: "played"; readonly key: string; readonly count: number; readonly expanded: boolean }
  | { readonly type: "note"; readonly key: string; readonly note: PlanNote };

export type PlanEmpty = "noPlan" | "noConcerts" | null;

export interface PlanInput {
  readonly concerts: readonly Concert[];
  readonly stages: readonly Stage[];
  readonly plannedIds: ReadonlySet<string>;
  readonly days: readonly string[];
  readonly filters: PlanFilters;
  readonly now: Date;
  readonly playedExpanded: boolean;
  readonly note: PlanNote | null;
  readonly serial: string;
  readonly accentSuppressed: boolean;
}

export interface PlanView {
  readonly day: string | null;
  readonly nowPass: NowPassData | null;
  readonly rows: readonly PlanRow[];
  readonly empty: PlanEmpty;
  /** Concerts of the day in all stages – „Pokaż wszystkie koncerty · n”. */
  readonly dayCount: number;
}

const byStart = (a: Concert, b: Concert): number => Date.parse(a.startsAt) - Date.parse(b.startsAt);

export function buildPlanView(input: PlanInput): PlanView {
  const { concerts, stages, plannedIds, filters, now, note } = input;
  const day = filters.day ?? defaultDay(input.days, now);
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const stageCodes = stageCodesOf(stages);
  const nowMs = now.getTime();

  const planned = concerts.filter((c) => plannedIds.has(c.id));
  const ofDay = concerts.filter((c) => festivalDayOf(c.startsAt) === day);
  const visible = ofDay
    .filter((c) => filters.scope === "all" || plannedIds.has(c.id))
    .filter((c) => {
      if (filters.stages.length === 0) return true;
      const code = stageCodes[c.stageId];
      return code !== undefined && filters.stages.includes(code);
    })
    .sort(byStart);

  const cardOf = (concert: Concert): PlanRow[] => {
    const stage = stageById.get(concert.stageId);
    if (stage === undefined) return [];
    const inPlan = plannedIds.has(concert.id);
    const other = inPlan ? firstConflict(concert, planned) : undefined;
    const otherStage = other ? stageById.get(other.stageId) : undefined;
    const card = toPerformanceCardProps(concert, stage, {
      inPlan,
      stageCodes,
      now,
      ...(other && otherStage ? { conflictWith: { concert: other, stage: otherStage } } : null),
    });
    const rows: PlanRow[] = [{ type: "perf", key: `perf-${concert.id}`, card }];
    if (note !== null && note.concertId === concert.id) rows.push({ type: "note", key: `note-${concert.id}`, note });
    return rows;
  };

  const playing = visible.filter((c) => Date.parse(c.startsAt) <= nowMs && nowMs < Date.parse(c.endsAt));
  const next = visible.filter((c) => Date.parse(c.startsAt) > nowMs);
  const played = visible.filter((c) => Date.parse(c.endsAt) <= nowMs);

  // TERAZ: a planned concert wins the pass; the next one is „Też teraz”.
  const current = [...playing].sort((a, b) => Number(plannedIds.has(b.id)) - Number(plannedIds.has(a.id)));
  const [first, second] = current;
  const firstStage = first ? stageById.get(first.stageId) : undefined;
  const secondStage = second ? stageById.get(second.stageId) : undefined;
  const secondCode = secondStage ? stageCodes[secondStage.id] : undefined;
  const nowPass =
    first && firstStage
      ? toNowPassProps(first, firstStage, {
          inPlan: plannedIds.has(first.id),
          serial: input.serial,
          accentSuppressed: input.accentSuppressed,
          stageCodes,
          now,
          ...(second && secondCode
            ? { alsoNow: strings.planScreen.alsoNow(second.artist, Number(secondCode.slice(1))) }
            : null),
        })
      : null;

  const rows: PlanRow[] = [];
  if (next.length > 0) {
    rows.push({ type: "header", key: "header-next", label: strings.planScreen.next });
    for (const concert of next) rows.push(...cardOf(concert));
  }
  if (played.length > 0) {
    rows.push({ type: "played", key: "played", count: played.length, expanded: input.playedExpanded });
    if (input.playedExpanded) for (const concert of played) rows.push(...cardOf(concert));
  }
  // A note whose card is not in the list (TERAZ, filtered out, no concert) goes first.
  if (note !== null && !rows.some((row) => row.type === "note")) {
    rows.unshift({ type: "note", key: `note-${note.concertId ?? "plan"}`, note });
  }

  let empty: PlanEmpty = null;
  if (visible.length === 0) {
    empty = filters.scope === "mine" && filters.stages.length === 0 ? "noPlan" : "noConcerts";
  }

  return { day, nowPass, rows, empty, dayCount: ofDay.length };
}

/* ------------------------------------------------------------------ */
/* getItemLayout                                                        */
/* ------------------------------------------------------------------ */

export function planRowHeight(row: PlanRow): number {
  switch (row.type) {
    case "header":
      return SECTION_HEADER_HEIGHT;
    case "perf":
      return performanceCardHeight(row.card.state === "conflict" && row.card.statusLine !== undefined);
    case "played":
      return PLAYED_ROW_HEIGHT;
    case "note":
      return PLAN_NOTE_HEIGHT;
  }
}

export interface RowLayout {
  readonly length: number;
  readonly offset: number;
}

/** Offsets from fixed row heights (100 % text only; 150 / 200 % rows wrap). */
export function rowLayouts<T>(rows: readonly T[], heightOf: (row: T) => number): readonly RowLayout[] {
  let offset = 0;
  return rows.map((row) => {
    const length = heightOf(row);
    const layout = { length, offset };
    offset += length;
    return layout;
  });
}

/** „20:03” for the TERAZ header. */
export function nowLabel(now: Date): string {
  return strings.planScreen.now(formatTime(now));
}
