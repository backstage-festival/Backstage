import type { SavedPlace } from "@/domain/entities/SavedPlace";
import { mockBearing } from "@/mocks/bearing";

import {
  ANNOUNCE_INTERVAL_MS,
  type Announcement,
  angleDifference,
  arrowAngle,
  buildTentRows,
  compassA11yLabel,
  compassStateOf,
  formatDistance,
  nextPlace,
  placeDescription,
  relativeAngle,
  savedWhen,
  shortestRotation,
  shouldAnnounce,
  spokenDistance,
  toSavedPlaceItemProps,
  turnWords,
  walkMinutes,
} from "../tentRows";

const here = { latitude: 54.3618, longitude: 18.6472 };

const place = (id: string, type: SavedPlace["type"], label = id): SavedPlace => ({
  id,
  userId: "u",
  label,
  type,
  location: { latitude: 54.3618, longitude: 18.6472 },
  savedAt: "2027-07-02T15:20:00+02:00",
});

describe("formatDistance", () => {
  it("shows metres below 1 km and kilometres with a comma above", () => {
    expect(formatDistance(240)).toBe("240 m");
    expect(formatDistance(239.6)).toBe("240 m");
    expect(formatDistance(1234)).toBe("1,2 km");
    expect(formatDistance(999.6)).toBe("1,0 km");
    expect(formatDistance(-3)).toBe("0 m");
  });
});

describe("spokenDistance", () => {
  it("rounds to 10 m and uses Polish plural forms", () => {
    expect(spokenDistance(243)).toBe("240 metrów");
    expect(spokenDistance(22)).toBe("20 metrów");
    expect(spokenDistance(3)).toBe("10 metrów");
    expect(spokenDistance(1234)).toBe("1,2 kilometra");
  });
});

describe("walkMinutes", () => {
  it("uses the domain walking speed (240 m ≈ 3 min) and never says 0", () => {
    expect(walkMinutes(240)).toBe(3);
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(1200)).toBe(17);
  });
});

describe("compass angles", () => {
  it("relativeAngle is the bearing minus the heading, 0–360", () => {
    expect(relativeAngle(90, 0)).toBe(90);
    expect(relativeAngle(10, 350)).toBe(20);
    expect(relativeAngle(350, 10)).toBe(340);
  });

  it("shortestRotation turns the short way and keeps an unbounded value", () => {
    expect(shortestRotation(350, 10)).toBe(370);
    expect(shortestRotation(10, 350)).toBe(-10);
    expect(shortestRotation(720, 90)).toBe(810);
    expect(shortestRotation(0, 180)).toBe(180);
  });

  it("arrowAngle uses the injected bearing and is 0 without a heading", () => {
    const north = { latitude: 54.37, longitude: 18.6472 };
    expect(arrowAngle(mockBearing, here, north, 0)).toBeCloseTo(0, 5);
    expect(arrowAngle(() => 90, here, north, 45)).toBe(45);
    expect(arrowAngle(() => 90, here, north, null)).toBe(0);
    expect(arrowAngle(() => 90, null, north, 10)).toBe(0);
  });

  it("mockBearing points east for a place to the east", () => {
    expect(mockBearing(here, { latitude: 54.3618, longitude: 18.66 })).toBeCloseTo(90, 0);
  });
});

describe("compassStateOf", () => {
  it("is near below 20 m, whatever the heading", () => {
    expect(compassStateOf({ distanceM: 19, heading: null, headingTimedOut: true })).toBe("near");
  });

  it("calibrates while waiting for the first heading or position", () => {
    expect(compassStateOf({ distanceM: 200, heading: null, headingTimedOut: false })).toBe("calibrating");
    expect(compassStateOf({ distanceM: null, heading: 10, headingTimedOut: false })).toBe("calibrating");
  });

  it("is noHeading when no heading arrived in time", () => {
    expect(compassStateOf({ distanceM: 200, heading: null, headingTimedOut: true })).toBe("noHeading");
  });

  it("guides with a position and a heading", () => {
    expect(compassStateOf({ distanceM: 20, heading: 10, headingTimedOut: false })).toBe("guiding");
  });
});

describe("TalkBack labels (C06)", () => {
  it("names the turn in degrees, rounded to 10°", () => {
    expect(turnWords(3)).toBe("prosto");
    expect(turnWords(357)).toBe("prosto");
    expect(turnWords(38)).toBe("skręć w prawo o 40 stopni");
    expect(turnWords(270)).toBe("skręć w lewo o 90 stopni");
    expect(turnWords(180)).toBe("skręć w prawo o 180 stopni");
  });

  it("builds the compass label for each state", () => {
    expect(compassA11yLabel("guiding", "Namiot", 243, 40)).toBe("Namiot: 240 metrów, skręć w prawo o 40 stopni");
    expect(compassA11yLabel("guiding", "Namiot", 243, 0)).toBe("Namiot: 240 metrów, prosto");
    expect(compassA11yLabel("near", "Namiot", 12.4, 0)).toBe("Jesteś blisko, 12 metrów. Rozglądaj się.");
    expect(compassA11yLabel("calibrating", "Namiot", 243, 0)).toBe("Kalibracja kompasu. Zakreśl telefonem ósemkę.");
    expect(compassA11yLabel("noHeading", "Namiot", 243, 0)).toBe(
      "Brak kompasu. Kierunek pokażemy na mapie. Namiot: 240 metrów.",
    );
    expect(compassA11yLabel("noHeading", "Namiot", null, 0)).toBe("Brak kompasu. Kierunek pokażemy na mapie.");
  });
});

describe("shouldAnnounce (C06 throttle)", () => {
  const T0 = new Date("2027-07-02T21:00:00Z").getTime();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const announcedNow = (
    state: Announcement["state"],
    angle: number,
    hasDistance = true,
    label = "x",
  ): Announcement => ({ label, state, angle, hasDistance, atMs: Date.now() });

  it("announces the first label", () => {
    expect(shouldAnnounce(null, { state: "guiding", angle: 0, hasDistance: true }, Date.now())).toBe(true);
  });

  it("stays quiet on small turns within 10 s", () => {
    const previous = announcedNow("guiding", 40);
    jest.advanceTimersByTime(ANNOUNCE_INTERVAL_MS - 1);

    expect(shouldAnnounce(previous, { state: "guiding", angle: 70, hasDistance: true }, Date.now())).toBe(false);
  });

  it("announces after 10 s even without a turn", () => {
    const previous = announcedNow("guiding", 40);
    jest.advanceTimersByTime(ANNOUNCE_INTERVAL_MS);

    expect(shouldAnnounce(previous, { state: "guiding", angle: 40, hasDistance: true }, Date.now())).toBe(true);
  });

  it("announces a turn of more than 30° at once, across north too", () => {
    const previous = announcedNow("guiding", 350);
    jest.advanceTimersByTime(1000);

    expect(shouldAnnounce(previous, { state: "guiding", angle: 25, hasDistance: true }, Date.now())).toBe(true);
    expect(shouldAnnounce(previous, { state: "guiding", angle: 15, hasDistance: true }, Date.now())).toBe(false);
  });

  it("announces a state change at once", () => {
    const previous = announcedNow("guiding", 0);
    jest.advanceTimersByTime(1000);

    expect(shouldAnnounce(previous, { state: "near", angle: 0, hasDistance: true }, Date.now())).toBe(true);
  });

  it("announces at once when the last announced label was empty (place still loading)", () => {
    const previous = announcedNow("calibrating", 0, false, "");
    jest.advanceTimersByTime(1000);

    expect(shouldAnnounce(previous, { state: "calibrating", angle: 0, hasDistance: false }, Date.now())).toBe(true);
  });

  it("announces the first GPS fix at once, in the same state", () => {
    const previous = announcedNow("calibrating", 0, false);
    jest.advanceTimersByTime(1000);

    expect(shouldAnnounce(previous, { state: "calibrating", angle: 0, hasDistance: true }, Date.now())).toBe(true);
    expect(shouldAnnounce(previous, { state: "calibrating", angle: 0, hasDistance: false }, Date.now())).toBe(false);
  });

  it("angleDifference is the short way round", () => {
    expect(angleDifference(350, 10)).toBe(20);
    expect(angleDifference(90, 270)).toBe(180);
  });
});

describe("toSavedPlaceItemProps", () => {
  it("maps a row with distance, time and a TalkBack label", () => {
    const item = toSavedPlaceItemProps(place("p1", "meeting_point", "Zbiórka"), "row", here, false);

    expect(item).toMatchObject({
      id: "p1",
      variant: "row",
      label: "Zbiórka",
      description: "Punkt zbiórki",
      icon: "flag",
      distance: "0 m",
      walk: "1 min",
      savedAt: "Pt 15:20",
      pending: false,
    });
    expect(item.accessibilityLabel).toBe("Zbiórka, Punkt zbiórki, 10 metrów, około 1 minuta pieszo");
  });

  it("reads the tent pass as on C08", () => {
    const far = { latitude: 54.36396, longitude: 18.6472 };
    const item = toSavedPlaceItemProps(place("t", "tent", "Namiot"), "tent", far, false);

    expect(item.description).toBe("");
    expect(item.accessibilityLabel).toBe("Twój namiot, Namiot. 240 metrów, 3 minuty.");
  });

  it("has no distance before the first GPS fix and says when it is saving", () => {
    const item = toSavedPlaceItemProps(place("local-1", "other", "Miejsce 1"), "row", null, true);

    expect(item.distance).toBeNull();
    expect(item.walk).toBeNull();
    expect(item.accessibilityLabel).toBe("Miejsce 1, Miejsce, zapisuję");
  });

  it("savedWhen gives the Warsaw weekday and time", () => {
    expect(savedWhen("2027-07-02T13:20:00+02:00")).toBe("Pt 13:20");
    expect(savedWhen("2027-07-03T22:30:00Z")).toBe("Nd 00:30");
  });
});

describe("buildTentRows / nextPlace", () => {
  it("lists every place except the tent pass under „Inne miejsca”", () => {
    const rows = buildTentRows([place("t", "tent"), place("a", "other")], "t", null, new Set());

    expect(rows.map((row) => row.key)).toEqual(["header-other", "a"]);
  });

  it("has no rows when only the tent is saved", () => {
    expect(buildTentRows([place("t", "tent")], "t", null, new Set())).toEqual([]);
  });

  it("saves the tent first, then numbered places", () => {
    expect(nextPlace([])).toEqual({ label: "Namiot", type: "tent" });
    expect(nextPlace([place("t", "tent"), place("a", "other")])).toEqual({ label: "Miejsce 2", type: "other" });
  });
});

describe("placeDescription", () => {
  it("leaves the tent without a description – the band already says „Twój namiot”", () => {
    expect(placeDescription("tent")).toBe("");
    expect(placeDescription("meeting_point")).toBe("Punkt zbiórki");
  });
});
