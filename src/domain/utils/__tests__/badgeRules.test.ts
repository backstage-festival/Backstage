import { DomainError } from "../../errors/DomainError";
import { evaluatePreparedBadge } from "../badgeRules";

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
