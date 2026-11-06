import type { GpsFix } from "../../entities/common";
import { DomainError } from "../../errors/DomainError";
import {
  MAX_ACCEPTED_ACCURACY_METERS,
  MAX_PLAUSIBLE_SPEED_MPS,
  evaluateGpsFix,
  filterGpsFixes,
} from "../gpsJumpFilter";

const origin = { latitude: 54.3627, longitude: 18.6491 };
const t0 = Date.parse("2027-07-02T22:00:00Z");

const fix = (
  metersNorth: number,
  secondsAfter: number,
  accuracyMeters: number | null = 10,
): GpsFix => ({
  location: {
    latitude: origin.latitude + metersNorth / 111195,
    longitude: origin.longitude,
  },
  timestamp: t0 + secondsAfter * 1000,
  accuracyMeters,
});

describe("evaluateGpsFix", () => {
  it("accepts the first fix without a speed", () => {
    expect(evaluateGpsFix(fix(0, 0), null)).toEqual({
      accepted: true,
      speedMps: null,
    });
  });

  it("accepts a walking-speed move and reports the speed", () => {
    expect(evaluateGpsFix(fix(20, 2), fix(0, 0))).toEqual({
      accepted: true,
      speedMps: 10,
    });
  });

  it("accepts a move at exactly the speed limit", () => {
    const result = evaluateGpsFix(fix(50, 2), fix(0, 0));
    expect(result).toEqual({
      accepted: true,
      speedMps: MAX_PLAUSIBLE_SPEED_MPS,
    });
  });

  it("rejects a jump faster than the limit", () => {
    expect(evaluateGpsFix(fix(500, 2), fix(0, 0))).toEqual({
      accepted: false,
      reason: "too_fast",
    });
  });

  it("rejects low accuracy but accepts exactly the limit and unknown accuracy", () => {
    expect(evaluateGpsFix(fix(0, 0, 51), null)).toEqual({
      accepted: false,
      reason: "low_accuracy",
    });
    expect(
      evaluateGpsFix(fix(0, 0, MAX_ACCEPTED_ACCURACY_METERS), null).accepted,
    ).toBe(true);
    expect(evaluateGpsFix(fix(0, 0, null), null).accepted).toBe(true);
  });

  it("rejects fixes that are older than or as old as the previous one", () => {
    expect(evaluateGpsFix(fix(5, 5), fix(0, 10))).toEqual({
      accepted: false,
      reason: "out_of_order",
    });
    expect(evaluateGpsFix(fix(5, 10), fix(0, 10))).toEqual({
      accepted: false,
      reason: "out_of_order",
    });
  });

  it.each([
    [{ ...fix(0, 0), timestamp: Number.NaN }],
    [{ ...fix(0, 0), accuracyMeters: -1 }],
    [{ ...fix(0, 0), location: { latitude: 95, longitude: 18.6 } }],
  ])("throws for an invalid fix %o", (bad) => {
    expect(() => evaluateGpsFix(bad, null)).toThrow(DomainError);
  });
});

describe("filterGpsFixes", () => {
  it("drops a single jump and keeps the next correct fix", () => {
    const a = fix(0, 0);
    const jump = fix(800, 2);
    const b = fix(10, 4);
    expect(filterGpsFixes([a, jump, b])).toEqual([a, b]);
  });

  it("does not modify the input array", () => {
    const input = [fix(0, 0), fix(800, 2)];
    filterGpsFixes(input);
    expect(input).toHaveLength(2);
  });

  it("returns an empty list for no fixes", () => {
    expect(filterGpsFixes([])).toEqual([]);
  });
});
