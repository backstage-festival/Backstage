/**
 * Component props – exactly as on the C boards (C01, C03, C04, C05, C09, C11).
 * UI-only types (TransitKind, StageId, IconName) live here, not in src/domain.
 */

/* ------------------------------------------------------------------ */
/* Shared UI types                                                      */
/* ------------------------------------------------------------------ */

/** Not in the domain – derived from Departure.routeName by the view mapper. */
export type TransitKind = "tram" | "bus" | "night" | "skm";

export type StageId = "s1" | "s2" | "s3";

/** The 41 interface icons (H04). */
export const ICON_NAMES = [
  "plan",
  "map",
  "crew",
  "tent",
  "return",
  "tram",
  "add",
  "minus",
  "inPlan",
  "close",
  "warning",
  "signal",
  "noSignal",
  "sync",
  "clock",
  "pin",
  "arrowRight",
  "arrowLeft",
  "chevronRight",
  "chevronDown",
  "download",
  "share",
  "bell",
  "bellOff",
  "eye",
  "eyeOff",
  "weather",
  "locate",
  "north",
  "navArrow",
  "flag",
  "parking",
  "moon",
  "calendar",
  "stage",
  "toilet",
  "water",
  "medical",
  "gate",
  "food",
  "more",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/* ------------------------------------------------------------------ */
/* C01 · PerformanceCard + NowPass                                      */
/* ------------------------------------------------------------------ */

export type PerformanceCardState = "default" | "inPlan" | "conflict" | "played";

export interface PerformanceCardProps {
  id: string;
  artist: string;
  stage: StageId; // 's1' | 's2' | 's3'
  stageName: string; // „Główna”
  start: string; // „20:15”
  end: string; // „21:30”
  state: PerformanceCardState;
  statusLine?: string; // „Kolizja · S1 od 22:15”
  onPress: (id: string) => void; // opens the modal
  onTogglePlan: (id: string) => void; // optimistic
  testID?: string;
}

export interface NowPassProps {
  id: string;
  artist: string;
  stage: StageId;
  stageName: string;
  range: string;
  remainingMin: number;
  progress: number; // 0–1
  serial: string;
  inPlan: boolean;
  alsoNow?: string;
  accentSuppressed: boolean; // alert on screen
  onPress: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/* C03 · ConnectionBar                                                  */
/* ------------------------------------------------------------------ */

export type ConnectionBarState = "online" | "offline" | "syncing" | "noData";

export interface ConnectionBarProps {
  state: ConnectionBarState;
  detail: string; // „Dane z 14:05”
  queued: number;
  syncProgress?: { done: number; total: number };
  trailing?: string; // „Odświeżę sam”
  testID?: string;
}

/* ------------------------------------------------------------------ */
/* C04 · MessageBubble                                                  */
/* ------------------------------------------------------------------ */

export type MessageStatus = "queued" | "sending" | "sent" | "stale" | "failed";
export type MessageAuthor = "me" | "crew";

export interface MessageBubbleProps {
  id: string;
  author: MessageAuthor;
  senderName?: string; // only 'crew'
  time: string;
  text: string;
  status?: MessageStatus; // only 'me'
  statusLabel?: string; // „W kolejce · 21:48”
  onCancel?: (id: string) => void; // queued
  onSendAnyway?: (id: string) => void; // stale
  onRetry?: (id: string) => void; // failed – „Spróbuj ponownie”
  onDelete?: (id: string) => void; // stale | failed
  testID?: string;
}

/* ------------------------------------------------------------------ */
/* C05 · StopCard + DepartureRow                                        */
/* ------------------------------------------------------------------ */

export type DepartureState = "missed" | "leaveNow" | "leaveAt" | "later";
export type DataFreshness = "live" | "stale";

export interface DepartureRowProps {
  line: string;
  kind: TransitKind;
  direction: string;
  time: string; // „21:49”
  inMinutes: string; // „4 min” / „ok. 8 min”
  state: DepartureState;
  note?: string; // „Wyjdź o 21:58”
  freshness: DataFreshness;
}

export interface StopCardProps {
  name: string;
  meta: string;
  freshness: DataFreshness;
  departures: readonly DepartureRowProps[];
  onGuide: () => void;
}

/* ------------------------------------------------------------------ */
/* C09 · Button + IconButton                                            */
/* ------------------------------------------------------------------ */

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSurface = "dark" | "laminate" | "accent";

export interface ButtonProps {
  label: string;
  variant: ButtonVariant;
  surface: ButtonSurface;
  icon?: IconName;
  disabled: boolean;
  disabledReason?: string; // required when disabled
  width: "fill" | "hug";
  accessibilityHint?: string;
  onPress: () => void;
}

export interface IconButtonProps {
  icon: IconName;
  accessibilityLabel: string; // required
  accessibilityHint?: string;
  selected?: boolean;
  surface: ButtonSurface;
  disabled: boolean;
  onPress: () => void;
}

/* ------------------------------------------------------------------ */
/* C11 · StatusTag                                                      */
/* ------------------------------------------------------------------ */

export type StatusTagTone =
  | "neutral"
  | "laminate"
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "offline";

export interface StatusTagProps {
  label: string;
  tone: StatusTagTone;
  icon?: IconName;
  fill: "solid" | "outline" | "dashed";
  testID?: string;
}
