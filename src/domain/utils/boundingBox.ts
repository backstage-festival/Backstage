import type { BoundingBox, Coordinates } from "../entities/common";
import { DomainError } from "../errors/DomainError";
import { assertValidCoordinates } from "./geofence";

/** Same Earth radius as distanceCalculator: 6 371 km × π / 180. */
export const METERS_PER_DEGREE_LATITUDE = 111_195;

export function boundingBoxAround(
  center: Coordinates,
  radiusMeters: number,
): BoundingBox {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    throw new DomainError("INVALID_RADIUS", `Invalid radius: ${radiusMeters}.`);
  }
  assertValidCoordinates(center);

  const latitudeDelta = radiusMeters / METERS_PER_DEGREE_LATITUDE;
  const longitudeDelta =
    radiusMeters /
    (METERS_PER_DEGREE_LATITUDE * Math.cos((center.latitude * Math.PI) / 180));

  return {
    minLatitude: center.latitude - latitudeDelta,
    maxLatitude: center.latitude + latitudeDelta,
    minLongitude: center.longitude - longitudeDelta,
    maxLongitude: center.longitude + longitudeDelta,
  };
}

export function isInsideBoundingBox(
  point: Coordinates,
  box: BoundingBox,
): boolean {
  return (
    point.latitude >= box.minLatitude &&
    point.latitude <= box.maxLatitude &&
    point.longitude >= box.minLongitude &&
    point.longitude <= box.maxLongitude
  );
}
