import type { Coordinates } from "@/domain/entities/common";

/**
 * Initial great-circle bearing from → to, 0–360° clockwise from north.
 * TODO: replace with bearingCalculator from feature/compass-network-service
 * (kept out of src/domain on purpose – the domain version lives on that branch).
 */
export function mockBearing(from: Coordinates, to: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(from.latitude);
  const phi2 = toRad(to.latitude);
  const deltaLambda = toRad(to.longitude - from.longitude);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
