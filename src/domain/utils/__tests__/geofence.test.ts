import { DomainError } from "../../errors/DomainError";
import { calculateDistanceInMeters } from "../distanceCalculator";
import {
  CHECK_IN_RADIUS_METERS,
  checkGeofence,
  isWithinGeofence,
} from "../geofence";

const stage = { latitude: 54.3627, longitude: 18.6491 };

const northOf = (meters: number) => ({
  latitude: stage.latitude + meters / 111195,
  longitude: stage.longitude,
});

describe("checkGeofence", () => {
  it("uses a 50 m check-in radius by default", () => {
    expect(CHECK_IN_RADIUS_METERS).toBe(50);
  });

  it("is inside when standing at the stage", () => {
    expect(checkGeofence(stage, stage)).toEqual({
      isInside: true,
      distanceMeters: 0,
    });
  });

  it("is inside at exactly the radius", () => {
    const edge = northOf(50);
    expect(
      calculateDistanceInMeters(
        edge.latitude,
        edge.longitude,
        stage.latitude,
        stage.longitude,
      ),
    ).toBe(50);
    expect(isWithinGeofence(edge, stage)).toBe(true);
  });

  it("is outside just past the radius and reports the distance", () => {
    const result = checkGeofence(northOf(51), stage);
    expect(result.isInside).toBe(false);
    expect(result.distanceMeters).toBe(51);
  });

  it("accepts a custom radius", () => {
    expect(isWithinGeofence(northOf(120), stage, 150)).toBe(true);
    expect(isWithinGeofence(northOf(120), stage)).toBe(false);
  });

  it("accepts a zero radius only at the exact point", () => {
    expect(isWithinGeofence(stage, stage, 0)).toBe(true);
    expect(isWithinGeofence(northOf(1), stage, 0)).toBe(false);
  });

  it.each([
    [{ latitude: Number.NaN, longitude: 18.6 }],
    [{ latitude: 91, longitude: 18.6 }],
    [{ latitude: 54.3, longitude: -181 }],
    [{ latitude: Number.POSITIVE_INFINITY, longitude: 18.6 }],
  ])("throws INVALID_COORDINATES for %o", (position) => {
    expect(() => checkGeofence(position, stage)).toThrow(DomainError);
  });

  it.each([-1, Number.NaN])("throws INVALID_RADIUS for %p", (radius) => {
    expect(() => checkGeofence(stage, stage, radius)).toThrow(DomainError);
  });
});
