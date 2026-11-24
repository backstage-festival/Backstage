import { getMessageDeliveryState } from "@/domain/utils/messageStaleness";

import { demoAnchor, minutesFrom, shiftIso } from "../relativeTime";

describe("relative demo time", () => {
  it("floors the anchor to a whole minute", () => {
    expect(demoAnchor(Date.parse("2026-11-22T10:15:42.500Z"))).toBe(Date.parse("2026-11-22T10:15:00Z"));
    expect(minutesFrom(Date.parse("2026-11-22T10:15:00Z"), -40)).toBe("2026-11-22T09:35:00.000Z");
  });

  it("moves a board timestamp keeping its distance to the board clock", () => {
    const boardNow = new Date("2027-07-02T20:03:00+02:00");
    const anchor = Date.parse("2026-11-22T10:00:00Z");
    expect(shiftIso("2027-07-02T20:15:00+02:00", boardNow, anchor)).toBe("2026-11-22T10:12:00.000Z");
  });
});

describe("demo data", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-22T19:30:20Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the board states at the real clock", () => {
    jest.isolateModules(() => {
      // Loaded inside isolateModules, so the anchor is the fake clock above.
      const { demoConcerts, demoMessages, demoNow } = jest.requireActual<typeof import("../demoData")>("../demoData");
      const now = new Date(demoNow);

      const trio = demoConcerts.find((c) => c.id === "c-bursztyn-trio");
      expect(trio).toBeDefined();
      expect(Date.parse(trio?.endsAt ?? "") - demoNow).toBe(37 * 60_000);

      const states = demoMessages.map((m) => getMessageDeliveryState(m, now));
      expect(states).toEqual(["sent", "sent", "stale", "failed", "queued", "queued"]);
    });
  });
});
