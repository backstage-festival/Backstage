import { DomainError } from "../../errors/DomainError";
import { boundingBoxAround, isInsideBoundingBox } from "../boundingBox";
import { calculateDistanceInMeters } from "../distanceCalculator";

const center = { latitude: 54.3618, longitude: 18.6469 };

describe("boundingBoxAround", () => {
  const box = boundingBoxAround(center, 500);

  it("reaches the radius to the north and to the east", () => {
    const north = { latitude: box.maxLatitude, longitude: center.longitude };
    const east = { latitude: center.latitude, longitude: box.maxLongitude };

    expect(
      calculateDistanceInMeters(
        center.latitude,
        center.longitude,
        north.latitude,
        north.longitude,
      ),
    ).toBe(500);
    expect(
      calculateDistanceInMeters(
        center.latitude,
        center.longitude,
        east.latitude,
        east.longitude,
      ),
    ).toBe(500);
  });

  it("is wider in longitude than in latitude in Gdańsk", () => {
    const latitudeSpan = box.maxLatitude - box.minLatitude;
    const longitudeSpan = box.maxLongitude - box.minLongitude;

    expect(longitudeSpan).toBeGreaterThan(latitudeSpan * 1.6);
  });

  it("contains its corner, which is further away than the radius", () => {
    const corner = { latitude: box.maxLatitude, longitude: box.maxLongitude };

    expect(isInsideBoundingBox(corner, box)).toBe(true);
    expect(
      calculateDistanceInMeters(
        center.latitude,
        center.longitude,
        corner.latitude,
        corner.longitude,
      ),
    ).toBeGreaterThan(700);
  });

  it("does not contain a point just outside", () => {
    expect(
      isInsideBoundingBox(
        { latitude: box.maxLatitude + 0.0001, longitude: center.longitude },
        box,
      ),
    ).toBe(false);
  });

  it.each([-1, Number.NaN])("throws for an invalid radius %p", (radius) => {
    expect(() => boundingBoxAround(center, radius)).toThrow(DomainError);
  });

  it("throws for invalid coordinates", () => {
    expect(() =>
      boundingBoxAround({ latitude: 95, longitude: 18.6 }, 500),
    ).toThrow(DomainError);
  });
});
