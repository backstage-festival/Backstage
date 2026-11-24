import { useMemo } from "react";

import { mockBearing } from "@/mocks/bearing";
import { selectPlace, usePlacesStore } from "@/store";
import type { LoadStatus } from "@/store/optimistic";
import { strings } from "@/strings";
import type { CompassArrowProps } from "@/types/components";

import {
  arrowAngle,
  type BearingFn,
  compassA11yLabel,
  compassStateOf,
  distanceBetween,
  formatDistance,
  walkMinutes,
} from "./tentRows";
import { MOCK_GPS_ACCURACY_M, useHeading, usePosition } from "./useLocation";
import { useThrottledA11yLabel } from "./useThrottledA11yLabel";
import { usePlacesLoader } from "./useTentScreen";

// TODO: replace with bearingCalculator from feature/compass-network-service.
const bearing: BearingFn = mockBearing;

const t = strings.tent;

export type PlaceGuide =
  | { readonly status: "loading" }
  | { readonly status: "notFound" }
  /** No location permission – „Otwórz ustawienia” / „Spróbuj ponownie”. */
  | { readonly status: "noPermission"; readonly retry: () => void }
  | { readonly status: "ready"; readonly label: string; readonly compass: CompassArrowProps };

const isLoading = (status: LoadStatus) => status === "idle" || status === "loading";

/** The only place the 07b screen reads stores and sensors. */
export function usePlaceGuide(placeId: string): PlaceGuide {
  usePlacesLoader();
  const place = usePlacesStore(useMemo(() => selectPlace(placeId), [placeId]));
  const loadStatus = usePlacesStore((state) => state.loadStatus);
  const { position, permission, retry } = usePosition();
  const { heading, timedOut } = useHeading();

  const view = useMemo(() => {
    if (place === null) return null;
    const distanceM = position === null ? null : distanceBetween(position, place.location);
    const state = compassStateOf({ distanceM, heading, headingTimedOut: timedOut });
    const angle = arrowAngle(bearing, position, place.location, heading);
    return {
      label: place.label,
      state,
      angle,
      distance: distanceM === null ? t.noDistance : formatDistance(distanceM),
      walk: distanceM === null ? null : t.walk(walkMinutes(distanceM)),
      hasDistance: distanceM !== null,
      a11y: compassA11yLabel(state, place.label, distanceM, angle),
    };
  }, [place, position, heading, timedOut]);

  // Hooks run on every render, so the throttle gets neutral values without a place.
  const announced = useThrottledA11yLabel(
    view?.a11y ?? "",
    view?.state ?? "calibrating",
    view?.angle ?? 0,
    view?.hasDistance ?? false,
  );

  if (view === null) return isLoading(loadStatus) ? { status: "loading" } : { status: "notFound" };
  if (permission === "denied") return { status: "noPermission", retry };
  return {
    status: "ready",
    label: view.label,
    compass: {
      state: view.state,
      bearingDeg: view.angle,
      distance: view.distance,
      walk: view.walk,
      accuracy: t.accuracy(MOCK_GPS_ACCURACY_M),
      targetName: view.label,
      accessibilityLabel: announced,
    },
  };
}
