import { DomainError } from "../../errors/DomainError";
import { evaluateNightOwlBadge, evaluatePreparedBadge } from "../badgeRules";

describe("evaluatePreparedBadge", () => {
  const startsAt = "2027-07-02T12:00:00Z";

  it("is earned when the package was downloaded before the event", () => {
    expect(
      evaluatePreparedBadge({ startsAt, downloadedAt: "2027-07-01T18:00:00Z" }),
    ).toEqual({ code: "prepared", progress: 1, goal: 1, earned: true });
  });

  it("is not earned when the package was never downloaded", () => {
    expect(evaluatePreparedBadge({ startsAt, downloadedAt: null })).toEqual({
      code: "prepared",
      progress: 0,
      goal: 1,
      earned: false,
    });
  });

  it("counts 1 ms before the start but not the start itself", () => {
    expect(
      evaluatePreparedBadge({
        startsAt,
        downloadedAt: "2027-07-02T11:59:59.999Z",
      }).earned,
    ).toBe(true);
    expect(
      evaluatePreparedBadge({ startsAt, downloadedAt: startsAt }).earned,
    ).toBe(false);
  });

  it("is not earned when the package was downloaded during the event", () => {
    expect(
      evaluatePreparedBadge({ startsAt, downloadedAt: "2027-07-03T09:00:00Z" })
        .earned,
    ).toBe(false);
  });

  it("compares instants, not local clock times (CEST +02:00)", () => {
    expect(
      evaluatePreparedBadge({
        startsAt,
        downloadedAt: "2027-07-02T13:59:59+02:00",
      }).earned,
    ).toBe(true);
    expect(
      evaluatePreparedBadge({
        startsAt,
        downloadedAt: "2027-07-02T14:00:00+02:00",
      }).earned,
    ).toBe(false);
  });

  it("throws INVALID_DATE for a broken date", () => {
    expect(() =>
      evaluatePreparedBadge({ startsAt, downloadedAt: "garbage" }),
    ).toThrow(DomainError);
    expect(() =>
      evaluatePreparedBadge({ startsAt: "garbage", downloadedAt: null }),
    ).toThrow(expect.objectContaining({ code: "INVALID_DATE" }));
  });
});

describe("evaluateNightOwlBadge", () => {
  const evening = {
    id: "evening",
    startsAt: "2027-07-02T18:00:00Z",
    endsAt: "2027-07-02T19:00:00Z",
  };
  const headliner = {
    id: "headliner",
    startsAt: "2027-07-02T21:15:00Z",
    endsAt: "2027-07-02T22:30:00Z",
  };
  const concerts = [evening, headliner];

  it("is earned for a concert that ends after midnight festival time", () => {
    expect(
      evaluateNightOwlBadge([{ concertId: "headliner" }], concerts),
    ).toEqual({ code: "night_owl", progress: 1, goal: 1, earned: true });
  });

  it("is not earned without check-ins or only for evening concerts", () => {
    expect(evaluateNightOwlBadge([], concerts)).toEqual({
      code: "night_owl",
      progress: 0,
      goal: 1,
      earned: false,
    });
    expect(
      evaluateNightOwlBadge([{ concertId: "evening" }], concerts).earned,
    ).toBe(false);
  });

  it("does not count a concert that ends exactly at midnight CEST", () => {
    const endsAtMidnight = {
      id: "m",
      startsAt: "2027-07-02T21:00:00Z",
      endsAt: "2027-07-02T22:00:00Z",
    };
    expect(
      evaluateNightOwlBadge([{ concertId: "m" }], [endsAtMidnight]).earned,
    ).toBe(false);
  });

  it("uses festival time, not UTC, for a concert that starts after midnight", () => {
    const afterMidnight = {
      id: "a",
      startsAt: "2027-07-02T22:15:00Z",
      endsAt: "2027-07-02T23:00:00Z",
    };
    expect(
      evaluateNightOwlBadge([{ concertId: "a" }], [afterMidnight]).earned,
    ).toBe(true);
  });

  it("does not count a concert that starts at 6:00 festival time", () => {
    const morning = {
      id: "b",
      startsAt: "2027-07-03T04:00:00Z",
      endsAt: "2027-07-03T05:00:00Z",
    };
    expect(evaluateNightOwlBadge([{ concertId: "b" }], [morning]).earned).toBe(
      false,
    );
  });

  it("ignores check-ins for concerts missing from the package", () => {
    expect(
      evaluateNightOwlBadge([{ concertId: "removed" }], concerts).earned,
    ).toBe(false);
  });

  it("throws INVALID_TIME_RANGE for a checked-in concert with a broken range", () => {
    const broken = {
      id: "x",
      startsAt: "2027-07-02T22:00:00Z",
      endsAt: "2027-07-02T21:00:00Z",
    };
    expect(() => evaluateNightOwlBadge([{ concertId: "x" }], [broken])).toThrow(
      expect.objectContaining({ code: "INVALID_TIME_RANGE" }),
    );
  });
});
