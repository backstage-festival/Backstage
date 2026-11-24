import { useCallback, useEffect, useState } from "react";

import type { Coordinates, Unsubscribe } from "@/domain/entities/common";
import type { ILocationService } from "@/domain/repositories/ILocationService";
import { mockLocationService } from "@/mocks/mockStoreDeps";

// TEMP: mock service until #32 (DI) – screens never touch src/infrastructure.
const locationService: ILocationService = mockLocationService;

/** TEMP: ILocationService returns no GPS accuracy (GpsFix.accuracyMeters is not exposed) – TODO(#32). */
export const MOCK_GPS_ACCURACY_M = 8;

/** C06: no heading within this time → the phone has no compass („Brak kompasu”). */
export const HEADING_WAIT_MS = 3000;

export type LocationPermission = "unknown" | "granted" | "denied";

/**
 * Subscribes to a watcher that resolves asynchronously. If the screen unmounts
 * before the subscription resolves, it is cancelled as soon as it arrives.
 */
function subscribe(start: () => Promise<Unsubscribe>, isActive: () => boolean): { stop: () => void } {
  let unsubscribe: Unsubscribe | null = null;
  start()
    .then((stop) => {
      if (isActive()) unsubscribe = stop;
      else stop();
    })
    .catch(() => undefined);
  return {
    stop: () => {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

export interface PositionWatch {
  readonly position: Coordinates | null;
  readonly permission: LocationPermission;
  /** Ask for the permission and start watching again. */
  readonly retry: () => void;
}

/** Live GPS position while the screen is mounted. */
export function usePosition(): PositionWatch {
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [permission, setPermission] = useState<LocationPermission>("unknown");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let watch: { stop: () => void } | null = null;
    locationService
      .requestPermissions()
      .catch(() => false)
      .then((granted) => {
        if (!active) return;
        setPermission(granted ? "granted" : "denied");
        if (!granted) return;
        watch = subscribe(
          () => locationService.watchPosition((next) => {
            if (active) setPosition(next);
          }),
          () => active,
        );
      });
    return () => {
      active = false;
      watch?.stop();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { position, permission, retry };
}

export interface HeadingWatch {
  /** Degrees clockwise from north; null until the first reading. */
  readonly heading: number | null;
  readonly timedOut: boolean;
}

/**
 * Live compass heading. TODO: smooth with headingSmoother from
 * feature/compass-network-service – raw readings for now.
 */
export function useHeading(): HeadingWatch {
  const [heading, setHeading] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setTimedOut(true);
    }, HEADING_WAIT_MS);
    const watch = subscribe(
      () =>
        locationService.watchHeading((degrees) => {
          if (!active) return;
          clearTimeout(timer);
          setHeading(degrees);
        }),
      () => active,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      watch.stop();
    };
  }, []);

  return { heading, timedOut: heading === null && timedOut };
}
