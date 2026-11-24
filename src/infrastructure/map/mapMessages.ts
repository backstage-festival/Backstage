import type { BoundingBox, Coordinates } from "../../domain/entities/common";

/** Marker kinds the offline Leaflet map (and issue #44's icon set) know how to draw. */
export const MAP_MARKER_TYPES = [
  "s1",
  "s2",
  "s3",
  "toilet",
  "water",
  "medical",
  "gate",
  "food",
  "stop",
  "saved",
  "me",
] as const;

export type MapMarkerType = (typeof MAP_MARKER_TYPES)[number];

export interface MapMarker extends Coordinates {
  readonly id: string;
  readonly type: MapMarkerType;
  readonly selected?: boolean;
}

/** Accessibility themes for the marker set (H04 / issue #44). */
export const MAP_THEMES = ["domyslny", "wzory-cvd", "wysoki-kontrast"] as const;

export type MapTheme = (typeof MAP_THEMES)[number];

/* ------------------------------------------------------------------ */
/* RN -> map (sent via injectJavaScript)                                */
/* ------------------------------------------------------------------ */

export type MapCommand =
  | { readonly type: "setMarkers"; readonly markers: readonly MapMarker[] }
  | {
      readonly type: "setUserPosition";
      readonly position: Coordinates | null;
      readonly headingDegrees?: number;
    }
  | {
      readonly type: "centerOn";
      readonly latitude: number;
      readonly longitude: number;
      readonly zoom?: number;
    }
  | { readonly type: "setTheme"; readonly theme: MapTheme };

/** Wraps a command as a string safe to pass to WebView#injectJavaScript. */
export function buildInjectedCommand(command: MapCommand): string {
  const payload = JSON.stringify(command);
  return `window.__backstageHandleCommand && window.__backstageHandleCommand(${payload}); true;`;
}

/* ------------------------------------------------------------------ */
/* map -> RN (received via the WebView's onMessage)                     */
/* ------------------------------------------------------------------ */

export type MapEvent =
  | { readonly type: "mapReady" }
  | { readonly type: "markerPressed"; readonly markerId: string }
  | { readonly type: "boundsChanged"; readonly bounds: BoundingBox };

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isBoundingBox(value: unknown): value is BoundingBox {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const box = value as Record<string, unknown>;
  return (
    isFiniteNumber(box.minLatitude) &&
    isFiniteNumber(box.maxLatitude) &&
    isFiniteNumber(box.minLongitude) &&
    isFiniteNumber(box.maxLongitude)
  );
}

/**
 * Parses and validates a raw string from the WebView's `onMessage` event.
 * Returns `null` instead of throwing when the payload is malformed JSON or
 * does not match a known `MapEvent` shape.
 */
export function parseMapEvent(raw: string): MapEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const event = parsed as Record<string, unknown>;

  if (event.type === "mapReady") {
    return { type: "mapReady" as const };
  }

  if (event.type === "markerPressed" && typeof event.markerId === "string") {
    return { type: "markerPressed", markerId: event.markerId };
  }

  if (event.type === "boundsChanged" && isBoundingBox(event.bounds)) {
    return { type: "boundsChanged", bounds: event.bounds };
  }

  return null;
}
