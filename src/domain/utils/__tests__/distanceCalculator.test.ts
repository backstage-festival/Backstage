import { calculateDistanceInMeters } from "../distanceCalculator";

describe("calculateDistanceInMeters", () => {
  it("returns 0 for the same point", () => {
    expect(calculateDistanceInMeters(54.352, 18.646, 54.352, 18.646)).toBe(0);
  });

  it("returns about 111195 m for 1 degree of latitude", () => {
    expect(calculateDistanceInMeters(0, 0, 1, 0)).toBe(111195);
  });

  it("gives the same distance in both directions", () => {
    const ab = calculateDistanceInMeters(54.352, 18.646, 54.371, 18.618);
    const ba = calculateDistanceInMeters(54.371, 18.618, 54.352, 18.646);
    expect(ab).toBe(ba);
  });
});
