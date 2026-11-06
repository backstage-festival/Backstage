import { DomainError } from "../../errors/DomainError";
import {
  CACHE_TTL_MS,
  getCacheFreshness,
  isCacheValid,
  isEventPackageValid,
} from "../cacheValidity";

describe("getCacheFreshness", () => {
  const fetchedAt = "2027-07-02T21:40:00Z";

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fetchedAt));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is valid right after fetching", () => {
    expect(getCacheFreshness(fetchedAt, "departures")).toEqual({
      isValid: true,
      ageMs: 0,
      expiresAt: "2027-07-02T21:50:00.000Z",
    });
  });

  it("expires exactly when the TTL passes", () => {
    jest.advanceTimersByTime(CACHE_TTL_MS.departures - 1);
    expect(isCacheValid(fetchedAt, "departures")).toBe(true);

    jest.advanceTimersByTime(1);
    expect(isCacheValid(fetchedAt, "departures")).toBe(false);
  });

  it("uses a different TTL per data kind", () => {
    jest.advanceTimersByTime(30 * 60_000);
    expect(isCacheValid(fetchedAt, "departures")).toBe(false);
    expect(isCacheValid(fetchedAt, "transitAlerts")).toBe(true);
    expect(isCacheValid(fetchedAt, "weather")).toBe(true);
  });

  it("treats a fetchedAt in the future as age 0", () => {
    const result = getCacheFreshness("2027-07-02T21:45:00Z", "departures");
    expect(result.ageMs).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it("throws for an invalid fetchedAt", () => {
    expect(() => getCacheFreshness("garbage", "weather")).toThrow(DomainError);
  });
});

describe("isEventPackageValid", () => {
  const event = {
    downloadedAt: "2027-06-30T18:00:00Z",
    endsAt: "2027-07-04T23:59:00Z",
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is invalid when the package was never downloaded", () => {
    jest.setSystemTime(new Date("2027-07-02T12:00:00Z"));
    expect(isEventPackageValid({ ...event, downloadedAt: null })).toBe(false);
  });

  it("is valid during the event and at its last minute", () => {
    jest.setSystemTime(new Date("2027-07-02T12:00:00Z"));
    expect(isEventPackageValid(event)).toBe(true);

    jest.setSystemTime(new Date(event.endsAt));
    expect(isEventPackageValid(event)).toBe(true);
  });

  it("is invalid after the event has ended", () => {
    jest.setSystemTime(new Date("2027-07-05T00:00:00Z"));
    expect(isEventPackageValid(event)).toBe(false);
  });

  it("throws for invalid dates", () => {
    expect(() => isEventPackageValid({ ...event, endsAt: "garbage" })).toThrow(
      DomainError,
    );
    expect(() =>
      isEventPackageValid({ ...event, downloadedAt: "garbage" }),
    ).toThrow(DomainError);
  });
});
