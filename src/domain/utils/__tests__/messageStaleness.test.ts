import { DomainError } from "../../errors/DomainError";
import {
  MESSAGE_STALE_AFTER_MS,
  getMessageAgeMs,
  getMessageDeliveryState,
  isMessageStale,
} from "../messageStaleness";

describe("message staleness", () => {
  const base = {
    status: "queued" as const,
    attempts: 0,
    nextAttemptAt: null,
    createdAt: "2027-07-02T22:00:00Z",
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T22:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses a 30 minute threshold", () => {
    expect(MESSAGE_STALE_AFTER_MS).toBe(30 * 60_000);
  });

  it("becomes stale exactly at the threshold", () => {
    jest.advanceTimersByTime(MESSAGE_STALE_AFTER_MS - 1);
    expect(isMessageStale(base)).toBe(false);

    jest.advanceTimersByTime(1);
    expect(isMessageStale(base)).toBe(true);
  });

  it("is not stale when createdAt is in the future", () => {
    const future = { ...base, createdAt: "2027-07-02T22:10:00Z" };
    expect(getMessageAgeMs(future)).toBe(-10 * 60_000);
    expect(isMessageStale(future)).toBe(false);
  });

  it("returns queued for a fresh message", () => {
    expect(getMessageDeliveryState(base)).toBe("queued");
  });

  it("returns stale for an old queued message", () => {
    jest.advanceTimersByTime(MESSAGE_STALE_AFTER_MS);
    expect(getMessageDeliveryState(base)).toBe("stale");
  });

  it("returns failed when retries stopped, even if the message is old", () => {
    jest.advanceTimersByTime(MESSAGE_STALE_AFTER_MS);
    expect(getMessageDeliveryState({ ...base, attempts: 8 })).toBe("failed");
  });

  it("keeps queued while a retry is still scheduled", () => {
    const retrying = {
      ...base,
      attempts: 2,
      nextAttemptAt: "2027-07-02T22:00:10Z",
    };
    expect(getMessageDeliveryState(retrying)).toBe("queued");
  });

  it("never marks a sent message as stale", () => {
    jest.advanceTimersByTime(2 * MESSAGE_STALE_AFTER_MS);
    expect(getMessageDeliveryState({ ...base, status: "sent" })).toBe("sent");
  });

  it("throws for an invalid createdAt", () => {
    expect(() => isMessageStale({ createdAt: "garbage" })).toThrow(DomainError);
  });
});
