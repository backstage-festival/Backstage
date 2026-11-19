import { DomainError } from "../../errors/DomainError";
import {
  evaluateAllDaysBadge,
  evaluateNightOwlBadge,
  evaluatePreparedBadge,
  evaluateThreeStagesBadge,
} from "../badgeRules";

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

describe("evaluateAllDaysBadge", () => {
  const day1 = { id: "d1", startsAt: "2027-07-02T18:00:00Z" };
  const day1Late = { id: "d1-late", startsAt: "2027-07-02T21:15:00Z" };
  const day2 = { id: "d2", startsAt: "2027-07-03T18:00:00Z" };
  const day3 = { id: "d3", startsAt: "2027-07-04T18:00:00Z" };
  const concerts = [day1, day1Late, day2, day3];

  it("is earned with a check-in on every festival day", () => {
    expect(
      evaluateAllDaysBadge(
        [{ concertId: "d1" }, { concertId: "d2" }, { concertId: "d3" }],
        concerts,
      ),
    ).toEqual({ code: "all_three_days", progress: 3, goal: 3, earned: true });
  });

  it("counts each day once and shows progress for missing days", () => {
    expect(
      evaluateAllDaysBadge(
        [{ concertId: "d1" }, { concertId: "d1-late" }, { concertId: "d2" }],
        concerts,
      ),
    ).toEqual({ code: "all_three_days", progress: 2, goal: 3, earned: false });
  });

  it("assigns a concert after midnight to the previous festival day", () => {
    const afterMidnight = { id: "late", startsAt: "2027-07-02T22:15:00Z" };
    const nextEvening = { id: "next", startsAt: "2027-07-03T18:00:00Z" };
    const twoDays = [day1, afterMidnight, nextEvening];

    expect(
      evaluateAllDaysBadge(
        [{ concertId: "late" }, { concertId: "next" }],
        twoDays,
      ),
    ).toEqual({ code: "all_three_days", progress: 2, goal: 2, earned: true });
  });

  it("starts a new festival day at 6:00 festival time", () => {
    const beforeSix = { id: "x", startsAt: "2027-07-03T03:59:00Z" };
    const atSix = { id: "y", startsAt: "2027-07-03T04:00:00Z" };

    expect(evaluateAllDaysBadge([], [day1, beforeSix]).goal).toBe(1);
    expect(evaluateAllDaysBadge([], [day1, atSix]).goal).toBe(2);
  });

  it("is not earned for an empty package", () => {
    expect(evaluateAllDaysBadge([], [])).toEqual({
      code: "all_three_days",
      progress: 0,
      goal: 1,
      earned: false,
    });
  });

  it("throws INVALID_DATE for a concert with a broken start", () => {
    expect(() =>
      evaluateAllDaysBadge([], [{ id: "z", startsAt: "garbage" }]),
    ).toThrow(expect.objectContaining({ code: "INVALID_DATE" }));
  });
});

describe("evaluateThreeStagesBadge", () => {
  const concerts = [
    { id: "c1", stageId: "main" },
    { id: "c2", stageId: "main" },
    { id: "c3", stageId: "docks" },
    { id: "c4", stageId: "tent" },
    { id: "c5", stageId: "extra" },
  ];

  it("is earned after check-ins on three different stages", () => {
    expect(
      evaluateThreeStagesBadge(
        [{ concertId: "c1" }, { concertId: "c3" }, { concertId: "c4" }],
        concerts,
      ),
    ).toEqual({ code: "three_stages", progress: 3, goal: 3, earned: true });
  });

  it("counts the same stage only once", () => {
    expect(
      evaluateThreeStagesBadge(
        [{ concertId: "c1" }, { concertId: "c2" }],
        concerts,
      ),
    ).toEqual({ code: "three_stages", progress: 1, goal: 3, earned: false });
  });

  it("caps progress at the goal", () => {
    expect(
      evaluateThreeStagesBadge(
        [
          { concertId: "c1" },
          { concertId: "c3" },
          { concertId: "c4" },
          { concertId: "c5" },
        ],
        concerts,
      ).progress,
    ).toBe(3);
  });

  it("ignores check-ins for concerts missing from the package", () => {
    expect(
      evaluateThreeStagesBadge([{ concertId: "removed" }], concerts),
    ).toEqual({ code: "three_stages", progress: 0, goal: 3, earned: false });
  });
});
