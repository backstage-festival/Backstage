import { DomainError } from "../../errors/DomainError";
import {
  findScheduleConflicts,
  hasScheduleConflict,
} from "../scheduleConflict";

const concert = (id: string, startsAt: string, endsAt: string) => ({
  id,
  startsAt,
  endsAt,
});

describe("findScheduleConflicts", () => {
  const a = concert("a", "2027-07-02T20:00:00Z", "2027-07-02T21:00:00Z");
  const b = concert("b", "2027-07-02T22:00:00Z", "2027-07-02T23:30:00Z");
  const planned = [a, b];

  it("returns overlapping concerts", () => {
    const candidate = concert(
      "x",
      "2027-07-02T20:30:00Z",
      "2027-07-02T21:30:00Z",
    );
    expect(findScheduleConflicts(candidate, planned).map((c) => c.id)).toEqual([
      "a",
    ]);
  });

  it("treats back-to-back concerts as no conflict", () => {
    const candidate = concert(
      "x",
      "2027-07-02T21:00:00Z",
      "2027-07-02T22:00:00Z",
    );
    expect(hasScheduleConflict(candidate, planned)).toBe(false);
  });

  it("detects a concert fully inside another", () => {
    const candidate = concert(
      "x",
      "2027-07-02T22:15:00Z",
      "2027-07-02T22:45:00Z",
    );
    expect(findScheduleConflicts(candidate, planned).map((c) => c.id)).toEqual([
      "b",
    ]);
  });

  it("ignores the same concert already in the plan", () => {
    expect(hasScheduleConflict(a, planned)).toBe(false);
  });

  it("compares instants across time zone offsets and midnight", () => {
    const late = [concert("n", "2027-07-02T23:30:00Z", "2027-07-03T00:30:00Z")];
    const candidate = concert(
      "x",
      "2027-07-03T02:00:00+02:00",
      "2027-07-03T03:00:00+02:00",
    );
    expect(hasScheduleConflict(candidate, late)).toBe(true);
  });

  it("returns no conflicts for an empty plan", () => {
    const candidate = concert(
      "x",
      "2027-07-02T20:00:00Z",
      "2027-07-02T21:00:00Z",
    );
    expect(findScheduleConflicts(candidate, [])).toEqual([]);
  });

  it.each([
    ["not a date", "2027-07-02T21:00:00Z"],
    ["2027-07-02T21:00:00Z", "2027-07-02T20:00:00Z"],
    ["2027-07-02T21:00:00Z", "2027-07-02T21:00:00Z"],
  ])("throws INVALID_TIME_RANGE for %s – %s", (startsAt, endsAt) => {
    const candidate = concert("x", startsAt, endsAt);
    expect(() => findScheduleConflicts(candidate, planned)).toThrow(
      DomainError,
    );
  });
});
