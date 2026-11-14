import { DomainError } from "../../errors/DomainError";
import { CHECK_IN_OPENS_BEFORE_MS, isCheckInOpen } from "../checkInWindow";

describe("isCheckInOpen", () => {
  const concert = {
    id: "c1",
    startsAt: "2027-07-02T20:00:00Z",
    endsAt: "2027-07-02T21:00:00Z",
  };
  const opensAt = Date.parse(concert.startsAt) - CHECK_IN_OPENS_BEFORE_MS;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens 15 minutes before the concert starts", () => {
    jest.setSystemTime(opensAt - 1);
    expect(isCheckInOpen(concert)).toBe(false);

    jest.advanceTimersByTime(1);
    expect(isCheckInOpen(concert)).toBe(true);
  });

  it("stays open until the concert ends and closes right after", () => {
    jest.setSystemTime(new Date(concert.endsAt));
    expect(isCheckInOpen(concert)).toBe(true);

    jest.advanceTimersByTime(1);
    expect(isCheckInOpen(concert)).toBe(false);
  });

  it("handles a concert that crosses midnight", () => {
    const late = {
      id: "c2",
      startsAt: "2027-07-02T22:30:00Z",
      endsAt: "2027-07-03T00:00:00Z",
    };
    jest.setSystemTime(new Date("2027-07-02T23:45:00Z"));
    expect(isCheckInOpen(late)).toBe(true);
  });

  it("throws for an invalid time range", () => {
    expect(() =>
      isCheckInOpen({
        id: "x",
        startsAt: "garbage",
        endsAt: "2027-07-02T21:00:00Z",
      }),
    ).toThrow(DomainError);
  });
});
