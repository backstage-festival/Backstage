import { DomainError } from "../../errors/DomainError";
import { calculateLeaveNow } from "../leaveNowCalculator";

describe("calculateLeaveNow", () => {
  const input = { startsAt: "2027-07-02T20:30:00Z", distanceMeters: 600 };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T20:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("tells the user to wait when there is enough time", () => {
    expect(calculateLeaveNow(input)).toEqual({
      status: "wait",
      leaveAt: "2027-07-02T20:16:40.000Z",
      secondsUntilLeave: 1000,
      walkSeconds: 500,
    });
  });

  it("switches to leave_now exactly at leaveAt", () => {
    jest.advanceTimersByTime(1000 * 1000);
    const result = calculateLeaveNow(input);
    expect(result.status).toBe("leave_now");
    expect(result.secondsUntilLeave).toBe(0);
  });

  it("is still leave_now at the latest departure time", () => {
    jest.setSystemTime(new Date("2027-07-02T20:21:40Z"));
    expect(calculateLeaveNow(input).status).toBe("leave_now");
  });

  it("is too_late one second after the latest departure", () => {
    jest.setSystemTime(new Date("2027-07-02T20:21:41Z"));
    expect(calculateLeaveNow(input).status).toBe("too_late");
  });

  it("is too_late after the concert has started", () => {
    jest.setSystemTime(new Date("2027-07-02T20:45:00Z"));
    expect(calculateLeaveNow(input).status).toBe("too_late");
  });

  it("uses a custom walking speed and buffer", () => {
    const result = calculateLeaveNow({
      ...input,
      walkingSpeedMps: 1.5,
      bufferSeconds: 0,
    });
    expect(result.walkSeconds).toBe(400);
    expect(result.leaveAt).toBe("2027-07-02T20:23:20.000Z");
  });

  it("accepts an explicit now instead of the system clock", () => {
    const result = calculateLeaveNow(input, new Date("2027-07-02T20:20:00Z"));
    expect(result.status).toBe("leave_now");
  });

  it.each([
    [{ startsAt: "not a date", distanceMeters: 600 }],
    [{ ...input, distanceMeters: -1 }],
    [{ ...input, distanceMeters: Number.NaN }],
    [{ ...input, walkingSpeedMps: 0 }],
    [{ ...input, bufferSeconds: -5 }],
  ])("throws DomainError for invalid input %o", (bad) => {
    expect(() => calculateLeaveNow(bad)).toThrow(DomainError);
  });
});
