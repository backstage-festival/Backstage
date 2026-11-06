import { calculateBearingInDegrees } from "../bearingCalculator";

describe("calculateBearingInDegrees", () => {
  it("returns 0 for a point due north", () => {
    expect(calculateBearingInDegrees(0, 0, 1, 0)).toBe(0);
  });

  it("returns 90 for a point due east", () => {
    expect(calculateBearingInDegrees(0, 0, 0, 1)).toBe(90);
  });

  it("returns 180 for a point due south", () => {
    expect(calculateBearingInDegrees(0, 0, -1, 0)).toBe(180);
  });

  it("returns 270 for a point due west", () => {
    expect(calculateBearingInDegrees(0, 0, 0, -1)).toBe(270);
  });

  it("stays within [0, 360)", () => {
    const bearing = calculateBearingInDegrees(54.371, 18.618, 54.352, 18.646);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});
