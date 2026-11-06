import { DomainError } from "../../errors/DomainError";
import {
  calculateNextAttemptAt,
  getRetryDelayMs,
  isDueForRetry,
  MAX_AUTO_RETRY_ATTEMPTS,
  RETRY_MAX_DELAY_MS,
} from "../retryBackoff";

describe("getRetryDelayMs", () => {
  it.each([
    [0, 0],
    [1, 5_000],
    [2, 10_000],
    [3, 20_000],
    [6, 160_000],
  ])("returns %p ms delay → %p", (attempts, expected) => {
    expect(getRetryDelayMs(attempts)).toBe(expected);
  });

  it("caps the delay at 5 minutes", () => {
    expect(getRetryDelayMs(7)).toBe(RETRY_MAX_DELAY_MS);
    expect(getRetryDelayMs(1000)).toBe(RETRY_MAX_DELAY_MS);
  });

  it.each([-1, 1.5, Number.NaN])(
    "throws for invalid attempts %p",
    (attempts) => {
      expect(() => getRetryDelayMs(attempts)).toThrow(DomainError);
    },
  );
});

describe("calculateNextAttemptAt and isDueForRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T22:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("schedules the next attempt from the current time", () => {
    expect(calculateNextAttemptAt(3)).toBe("2027-07-02T22:00:20.000Z");
  });

  it("becomes due only when nextAttemptAt is reached", () => {
    const message = {
      status: "queued" as const,
      nextAttemptAt: calculateNextAttemptAt(2),
    };
    expect(isDueForRetry(message)).toBe(false);

    jest.advanceTimersByTime(9_999);
    expect(isDueForRetry(message)).toBe(false);

    jest.advanceTimersByTime(1);
    expect(isDueForRetry(message)).toBe(true);
  });

  it("is due immediately when there is no nextAttemptAt", () => {
    expect(isDueForRetry({ status: "queued", nextAttemptAt: null })).toBe(true);
  });

  it("is never due once the message is sent", () => {
    expect(
      isDueForRetry({ status: "sent", nextAttemptAt: "2027-07-02T21:00:00Z" }),
    ).toBe(false);
  });

  it("throws for an invalid nextAttemptAt", () => {
    expect(() =>
      isDueForRetry({ status: "queued", nextAttemptAt: "garbage" }),
    ).toThrow(DomainError);
  });
  it("stops scheduling after the automatic retry limit", () => {
    expect(calculateNextAttemptAt(MAX_AUTO_RETRY_ATTEMPTS - 1)).not.toBeNull();
    expect(calculateNextAttemptAt(MAX_AUTO_RETRY_ATTEMPTS)).toBeNull();
  });
});
