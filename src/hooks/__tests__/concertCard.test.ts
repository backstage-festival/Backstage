import type { StageCodes } from "@/components/mappers";
import type { Concert, Stage } from "@/domain/entities/Event";
import { CHECK_IN_RADIUS_METERS } from "@/domain/utils/geofence";
import { strings } from "@/strings";

import {
  CHECK_IN_RANGE_SCALE_M,
  type CheckInStatusInput,
  checkInErrorNote,
  checkInStatusOf,
  checkInWindowOf,
  concertTiming,
  conflictTagOf,
  gaugeA11yLabel,
  gaugeStateOf,
  passBandLabel,
  rangeProgress,
  toCheckInRangeProps,
  toConcertPassProps,
} from "../concertCard";
import { passSerial } from "../planRows";

const stage: Stage = { id: "s1", eventId: "e", name: "Główna", location: { latitude: 54.3618, longitude: 18.6469 } };
const stage2: Stage = { id: "s2", eventId: "e", name: "Doki", location: { latitude: 54.3634, longitude: 18.6502 } };
const stageCodes: StageCodes = { s1: "s1", s2: "s2" };
/** What useConcertScreen passes for each concert – the same passSerial the Plan uses. */
const serialOf = (c: Concert): string => passSerial(c, 1, [wilga, atlas]);

const concert = (id: string, stageId: string, artist: string, startsAt: string, endsAt: string): Concert => ({
  id,
  eventId: "e",
  stageId,
  artist,
  startsAt,
  endsAt,
});

const wilga = concert("wilga", "s1", "Wilga i Fale", "2027-07-02T20:15:00+02:00", "2027-07-02T21:30:00+02:00");
const atlas = concert("atlas", "s1", "Northern Atlas", "2027-07-02T22:15:00+02:00", "2027-07-02T23:45:00+02:00");
const hanna = concert("hanna", "s2", "Hanna Sieradz", "2027-07-02T21:30:00+02:00", "2027-07-02T22:30:00+02:00");

/** Metres north of the stage – the domain distance is rounded to whole metres. */
const R = 6371e3;
const north = (meters: number) => ({
  latitude: stage.location.latitude + (meters / R) * (180 / Math.PI),
  longitude: stage.location.longitude,
});

const input = (overrides: Partial<CheckInStatusInput> = {}): CheckInStatusInput => ({
  checkedIn: false,
  window: "open",
  permission: "granted",
  position: north(30),
  stageLocation: stage.location,
  ...overrides,
});

describe("checkInStatusOf", () => {
  it("is in range at exactly 50 m and too far at 51 m (domain geofence)", () => {
    expect(CHECK_IN_RADIUS_METERS).toBe(50);
    expect(checkInStatusOf(input({ position: north(50) }))).toEqual({ kind: "inRange", distanceM: 50 });
    expect(checkInStatusOf(input({ position: north(51) }))).toEqual({ kind: "tooFar", distanceM: 51 });
  });

  it("needs a position and the permission", () => {
    expect(checkInStatusOf(input({ position: null }))).toEqual({ kind: "noLocation" });
    expect(checkInStatusOf(input({ permission: "denied", position: null }))).toEqual({ kind: "permissionDenied" });
  });

  it("is closed outside the time window, before the distance is checked", () => {
    expect(checkInStatusOf(input({ window: "notYet" }))).toEqual({ kind: "closed", window: "notYet" });
    expect(checkInStatusOf(input({ window: "ended", position: north(400) }))).toEqual({ kind: "closed", window: "ended" });
  });

  it("gives a saved check-in priority over distance, GPS and the window", () => {
    expect(checkInStatusOf(input({ checkedIn: true, position: north(800), window: "ended" }))).toEqual({
      kind: "checkedIn",
    });
    expect(checkInStatusOf(input({ checkedIn: true, permission: "denied", position: null }))).toEqual({
      kind: "checkedIn",
    });
  });

  it("is checked in while the write is in flight (Optimistic UI: the store marks it at the tap)", () => {
    // During the write the store has the id in both checkedInConcertIds and pendingIds.
    expect(checkInStatusOf(input({ checkedIn: true, position: north(30) }))).toEqual({ kind: "checkedIn" });
  });

  it("treats invalid coordinates as no location instead of throwing", () => {
    expect(checkInStatusOf(input({ position: { latitude: 200, longitude: 0 } }))).toEqual({ kind: "noLocation" });
  });
});

describe("checkInWindowOf", () => {
  it("opens 15 min before the start and closes at the end", () => {
    expect(checkInWindowOf(wilga, new Date("2027-07-02T19:59:00+02:00"))).toBe("notYet");
    expect(checkInWindowOf(wilga, new Date("2027-07-02T20:00:00+02:00"))).toBe("open");
    expect(checkInWindowOf(wilga, new Date("2027-07-02T21:30:00+02:00"))).toBe("open");
    expect(checkInWindowOf(wilga, new Date("2027-07-02T21:31:00+02:00"))).toBe("ended");
  });

  it("never throws on a broken time range", () => {
    expect(checkInWindowOf({ ...wilga, endsAt: wilga.startsAt }, new Date())).toBe("ended");
  });
});

describe("rangeProgress", () => {
  it("clamps the marker to 0–1", () => {
    expect(rangeProgress(0)).toBe(0);
    expect(rangeProgress(50)).toBeCloseTo(50 / CHECK_IN_RANGE_SCALE_M);
    expect(rangeProgress(10_000)).toBe(1);
    expect(rangeProgress(-20)).toBe(0);
    expect(rangeProgress(Number.NaN)).toBe(0);
  });

  it("builds the E05b bar labels", () => {
    const range = toCheckInRangeProps(450);
    expect(range.title).toBe("Podejdź bliżej · check-in od 50 m");
    expect(range.stageLabel).toBe("Scena · 50 m");
    expect(range.youLabel).toBe("Ty · 450 m");
    expect(range.zone).toBeCloseTo(0.1);
    expect(range.progress).toBeCloseTo(0.9);
  });
});

describe("gauge", () => {
  it("maps permission and distance to the gauge state", () => {
    expect(gaugeStateOf("denied", 30)).toBe("noPermission");
    expect(gaugeStateOf("granted", null)).toBe("locating");
    expect(gaugeStateOf("granted", 50)).toBe("inRange");
    expect(gaugeStateOf("granted", 51)).toBe("tooFar");
  });

  it("speaks the S05 TalkBack sentences", () => {
    expect(gaugeA11yLabel("inRange", 30)).toBe("Odległość od sceny: 30 metrów. W zasięgu check-inu.");
    expect(gaugeA11yLabel("tooFar", 450)).toBe(
      "Odległość od sceny: 450 metrów. Podejdź bliżej, check-in od 50 metrów.",
    );
  });
});

describe("pass labels", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("says „teraz” during the concert, with the remaining time and progress", () => {
    jest.setSystemTime(new Date("2027-07-02T20:22:00+02:00"));
    const now = new Date();
    expect(passBandLabel(1, "Główna", concertTiming(wilga, now))).toBe("S1 · Scena Główna · teraz");
    const pass = toConcertPassProps(wilga, stage, stageCodes, serialOf(wilga), now);
    expect(pass.remaining).toBe("Zostało 68 min");
    expect(pass.when).toBe("Pt 2.07 · 20:15–21:30");
    expect(pass.duration).toBeNull();
    expect(pass.progress).toBeCloseTo(7 / 75);
    expect(pass.accessibilityLabel).toBe(
      "Wilga i Fale. Scena 1 Główna, teraz, 20:15 do 21:30, zostało 68 minut.",
    );
  });

  it("says „za 2 h 12 min” before the concert and shows its length", () => {
    jest.setSystemTime(new Date("2027-07-02T20:03:00+02:00"));
    const now = new Date();
    expect(passBandLabel(1, "Główna", concertTiming(atlas, now))).toBe("S1 · Scena Główna · za 2 h 12 min");
    const pass = toConcertPassProps(atlas, stage, stageCodes, serialOf(atlas), now);
    expect(pass.duration).toBe("90 min");
    expect(pass.progress).toBeNull();
    // Shows exactly what passSerial gives (the Plan NowPass uses the same function).
    expect(pass.serial).toBe(strings.plan.pass.serial(passSerial(atlas, 1, [wilga, atlas])));
    expect(pass.serial).toBe("Nº 0702-S1-02");
  });

  it("drops the hours below one hour and says „zagrane” afterwards", () => {
    jest.setSystemTime(new Date("2027-07-02T21:30:00+02:00"));
    const now = new Date();
    expect(passBandLabel(1, "Główna", concertTiming(atlas, now))).toBe("S1 · Scena Główna · za 45 min");
    expect(passBandLabel(1, "Główna", concertTiming(wilga, now))).toBe("S1 · Scena Główna · zagrane");
  });
});

describe("conflictTagOf", () => {
  it("shows the planned concert it overlaps, only when this one is not planned", () => {
    expect(conflictTagOf(atlas, false, [hanna], [stage, stage2], stageCodes)).toEqual({
      label: "Kolizja · Hanna Sieradz, S2 do 22:30",
      accessibilityLabel: "Kolizja z Hanna Sieradz, scena 2 Doki, do 22:30.",
    });
    expect(conflictTagOf(atlas, true, [hanna], [stage, stage2], stageCodes)).toBeNull();
    expect(conflictTagOf(wilga, false, [hanna], [stage, stage2], stageCodes)).toBeNull();
  });
});

describe("checkInErrorNote", () => {
  it("shows only this concert's rollback", () => {
    expect(checkInErrorNote({ kind: "tooFar", concertId: "wilga", distanceMeters: 450 }, "wilga")?.label).toBe(
      "Za daleko od sceny · 450 m",
    );
    expect(checkInErrorNote({ kind: "saveFailed", concertId: "other" }, "wilga")).toBeNull();
    expect(checkInErrorNote({ kind: "loadFailed" }, "wilga")).toBeNull();
  });
});
