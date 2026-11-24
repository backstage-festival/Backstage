/**
 * Pure view mappers for S07 / 07b (Namiot). No React, no stores.
 * The direction to the target (bearing) is a parameter – the domain version
 * lives on another branch (see src/mocks/bearing.ts).
 */
import { formatTime } from "@/components/mappers";
import type { Coordinates } from "@/domain/entities/common";
import type { SavedPlace, SavedPlaceType } from "@/domain/entities/SavedPlace";
import { calculateDistanceInMeters } from "@/domain/utils/distanceCalculator";
import { DEFAULT_WALKING_SPEED_MPS } from "@/domain/utils/leaveNowCalculator";
import { strings } from "@/strings";
import type { CompassState, IconName, SavedPlaceItemProps, SavedPlaceVariant } from "@/types/components";

import { dayKeyOf } from "./planRows";

export type BearingFn = (from: Coordinates, to: Coordinates) => number;

const t = strings.tent;

/** C06: below this distance the arrow gives way to „Jesteś na miejscu”. */
export const NEAR_DISTANCE_M = 20;
const METERS_PER_KM = 1000;
/** TalkBack: the spoken distance and turn are rounded to 10 m / 10° (C06). */
const SPOKEN_STEP_M = 10;
const SPOKEN_STEP_DEG = 10;
/** C06: announce at most every 10 s, unless the direction changes by more than 30°. */
export const ANNOUNCE_INTERVAL_MS = 10_000;
export const ANNOUNCE_ANGLE_DEG = 30;

/**
 * Route param → one value. Without generated typed routes (CI: .expo/types is
 * gitignored) expo-router types a param as string | string[] | undefined.
 * Takes the first element of an array; missing or empty → null.
 */
export function firstParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first === "" ? null : first;
}

export function distanceBetween(from: Coordinates, to: Coordinates): number {
  return calculateDistanceInMeters(from.latitude, from.longitude, to.latitude, to.longitude);
}

const kmText = (m: number): string => (m / METERS_PER_KM).toFixed(1).replace(".", ",");

/** 240 → „240 m”, 1234 → „1,2 km”. Uppercase („240 M”) comes from the text style. */
export function formatDistance(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  return m < METERS_PER_KM ? t.meters(m) : t.kilometers(kmText(m));
}

/** 243 → „240 metrów”, 1234 → „1,2 kilometra”. */
export function spokenDistance(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  if (m >= METERS_PER_KM) return t.a11y.kilometersSpoken(kmText(m));
  const rounded = Math.max(SPOKEN_STEP_M, Math.round(m / SPOKEN_STEP_M) * SPOKEN_STEP_M);
  return rounded >= METERS_PER_KM ? t.a11y.kilometersSpoken(kmText(rounded)) : t.a11y.metersSpoken(rounded);
}

/** Walking minutes with the domain speed (leaveNowCalculator, 1,2 m/s), at least 1. 240 m → 3. */
export function walkMinutes(meters: number, speedMps: number = DEFAULT_WALKING_SPEED_MPS): number {
  return Math.max(1, Math.round(meters / speedMps / 60));
}

/** Any angle → 0 ≤ a < 360. */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Arrow angle: bearing to the target relative to where the top of the phone points. */
export function relativeAngle(bearing: number, heading: number): number {
  return normalizeDegrees(bearing - heading);
}

/**
 * Next value for the rotation Animated.Value. `current` is unbounded (it keeps
 * turning past 360), `target` is 0–360. Returns current + the shortest turn,
 * so 350° → 10° turns +20°, not −340°.
 */
export function shortestRotation(current: number, target: number): number {
  let delta = normalizeDegrees(target) - normalizeDegrees(current);
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return current + delta;
}

export interface CompassInput {
  readonly distanceM: number | null;
  readonly heading: number | null;
  /** No heading arrived within the wait time → the phone has no compass. */
  readonly headingTimedOut: boolean;
}

export function compassStateOf({ distanceM, heading, headingTimedOut }: CompassInput): CompassState {
  if (distanceM !== null && distanceM < NEAR_DISTANCE_M) return "near";
  if (heading === null) return headingTimedOut ? "noHeading" : "calibrating";
  if (distanceM === null) return "calibrating";
  return "guiding";
}

/** Smallest difference between two directions, 0–180°. */
export function angleDifference(a: number, b: number): number {
  const d = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return d > 180 ? 360 - d : d;
}

/** C06: „prosto” / „skręć w prawo o 40 stopni” / „skręć w lewo o 90 stopni”. */
export function turnWords(angle: number): string {
  const a = normalizeDegrees(angle);
  const side = a <= 180 ? "right" : "left";
  const degrees = Math.round((side === "right" ? a : 360 - a) / SPOKEN_STEP_DEG) * SPOKEN_STEP_DEG;
  return degrees === 0 ? t.a11y.straight : t.a11y.turn(side, degrees);
}

/** C06 TalkBack label of the compass block. */
export function compassA11yLabel(state: CompassState, label: string, distanceM: number | null, angle: number): string {
  switch (state) {
    case "near":
      return t.a11y.compassNear(t.a11y.metersSpoken(Math.max(0, Math.round(distanceM ?? 0))));
    case "calibrating":
      return t.a11y.compassCalibrating;
    case "noHeading":
      return t.a11y.compassNoHeading(
        distanceM === null ? null : t.a11y.compassTarget(label, spokenDistance(distanceM)),
      );
    case "guiding":
      return t.a11y.compassGuiding(label, spokenDistance(distanceM ?? 0), turnWords(angle));
  }
}

/** The label TalkBack last got, with what it was built from. */
export interface Announcement {
  readonly label: string;
  readonly state: CompassState;
  readonly angle: number;
  /** Whether a GPS distance was known when it was announced. */
  readonly hasDistance: boolean;
  readonly atMs: number;
}

/**
 * C06: a new label is announced on a state change, when the direction moved
 * by more than 30° since the last announcement, or when 10 s have passed –
 * never on every sensor reading. Also at once when nothing real was announced
 * yet (empty label while the place loads) and on the first GPS fix (or its loss).
 */
export function shouldAnnounce(
  previous: Announcement | null,
  next: { readonly state: CompassState; readonly angle: number; readonly hasDistance: boolean },
  nowMs: number,
): boolean {
  if (previous === null || previous.label === "") return true;
  if (previous.state !== next.state) return true;
  if (previous.hasDistance !== next.hasDistance) return true;
  if (angleDifference(previous.angle, next.angle) > ANNOUNCE_ANGLE_DEG) return true;
  return nowMs - previous.atMs >= ANNOUNCE_INTERVAL_MS;
}

/** Arrow angle for the compass; 0 until both a position and a heading are known. */
export function arrowAngle(
  bearing: BearingFn,
  from: Coordinates | null,
  to: Coordinates,
  heading: number | null,
): number {
  if (from === null || heading === null) return 0;
  return relativeAngle(bearing(from, to), heading);
}

export function placeIcon(type: SavedPlaceType): IconName {
  switch (type) {
    case "tent":
      return "tent";
    case "meeting_point":
      return "flag";
    case "parking":
      return "parking";
    case "other":
      return "pin";
  }
}

export type SavedPlaceItemData = Omit<
  SavedPlaceItemProps,
  "onPress" | "onGuide" | "onMore" | "onRename" | "onDelete" | "testID"
>;

/** ISO → „Pt 13:20” (weekday and time in Europe/Warsaw). */
export function savedWhen(iso: string): string {
  const [year, month, day] = dayKeyOf(iso).split("-").map(Number);
  const weekday =
    year === undefined || month === undefined || day === undefined
      ? undefined
      : strings.planScreen.weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return weekday === undefined ? formatTime(iso) : t.savedDay(weekday, formatTime(iso));
}

/** „Opis” until SavedPlace has a description: the type, empty for the tent. */
export function placeDescription(type: SavedPlaceType): string {
  return type === "tent" ? "" : t.type[type];
}

export function toSavedPlaceItemProps(
  place: SavedPlace,
  variant: SavedPlaceVariant,
  position: Coordinates | null,
  pending: boolean,
): SavedPlaceItemData {
  const distanceM = position === null ? null : distanceBetween(position, place.location);
  // The tent band already says „Twój namiot”; real descriptions wait for a SavedPlace field (Q11).
  const description = placeDescription(place.type);
  const minutes = distanceM === null ? null : walkMinutes(distanceM);
  const accessibilityLabel =
    variant === "tent"
      ? t.a11y.pass(
          place.label,
          description,
          distanceM === null || minutes === null
            ? null
            : `${spokenDistance(distanceM)}, ${t.a11y.minutesSpoken(minutes)}`,
        )
      : t.a11y.row(
          place.label,
          description,
          distanceM === null || minutes === null ? null : `${spokenDistance(distanceM)}, ${t.a11y.walkSpoken(minutes)}`,
        );
  return {
    id: place.id,
    variant,
    label: place.label,
    description,
    icon: placeIcon(place.type),
    distance: distanceM === null ? null : formatDistance(distanceM),
    walk: minutes === null ? null : t.walk(minutes),
    savedAt: savedWhen(place.savedAt),
    accessibilityLabel: pending ? t.a11y.withSaving(accessibilityLabel, variant === "tent") : accessibilityLabel,
    pending,
  };
}

/** What „Zapisz moją pozycję” saves: the tent while there is none, then „Miejsce n”. */
export function nextPlace(saved: readonly SavedPlace[]): { label: string; type: SavedPlaceType } {
  if (!saved.some((place) => place.type === "tent")) return { label: t.defaultTentLabel, type: "tent" };
  const others = saved.filter((place) => place.type === "other").length;
  return { label: t.defaultPlaceLabel(others + 1), type: "other" };
}

export type TentRow =
  | { readonly type: "header"; readonly key: string; readonly label: string }
  | { readonly type: "place"; readonly key: string; readonly item: SavedPlaceItemData };

/** S07 list under the tent pass: „Inne miejsca” + every place except the pass. */
export function buildTentRows(
  saved: readonly SavedPlace[],
  tentId: string | null,
  position: Coordinates | null,
  pendingIds: ReadonlySet<string>,
): readonly TentRow[] {
  const others = saved.filter((place) => place.id !== tentId);
  if (others.length === 0) return [];
  return [
    { type: "header", key: "header-other", label: t.otherPlaces },
    ...others.map(
      (place): TentRow => ({
        type: "place",
        key: place.id,
        item: toSavedPlaceItemProps(place, "row", position, pendingIds.has(place.id)),
      }),
    ),
  ];
}
