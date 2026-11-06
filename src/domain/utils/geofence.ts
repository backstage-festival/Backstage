import type { Coordinates } from "../entities/common";
import { DomainError } from "../errors/DomainError";
import { calculateDistanceInMeters } from "./distanceCalculator";

export const CHECK_IN_RADIUS_METERS = 50;

export interface GeofenceResult {
  readonly isInside: boolean;
  readonly distanceMeters: number;
}

export function assertValidCoordinates(point: Coordinates): void {
  const { latitude, longitude } = point;
  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  if (!valid) {
    throw new DomainError(
      "INVALID_COORDINATES",
      `Invalid coordinates: ${latitude}, ${longitude}.`,
    );
  }
}

export function checkGeofence(
  position: Coordinates,
  target: Coordinates,
  radiusMeters: number = CHECK_IN_RADIUS_METERS,
): GeofenceResult {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    throw new DomainError("INVALID_RADIUS", `Invalid radius: ${radiusMeters}.`);
  }
  assertValidCoordinates(position);
  assertValidCoordinates(target);

  const distanceMeters = calculateDistanceInMeters(
    position.latitude,
    position.longitude,
    target.latitude,
    target.longitude,
  );

  return { isInside: distanceMeters <= radiusMeters, distanceMeters };
}

export function isWithinGeofence(
  position: Coordinates,
  target: Coordinates,
  radiusMeters: number = CHECK_IN_RADIUS_METERS,
): boolean {
  return checkGeofence(position, target, radiusMeters).isInside;
}
