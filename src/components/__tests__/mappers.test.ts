import type { Concert, Stage } from "@/domain/entities/Event";
import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { Departure } from "@/domain/entities/Transit";

import {
  findConflict,
  formatTime,
  overlaps,
  toDepartureRowProps,
  toMessageBubbleProps,
  toNowPassProps,
  toPerformanceCardProps,
  transitKindOf,
  walkMeta,
} from "../mappers";

const s1: Stage = { id: "s1", eventId: "e", name: "Główna", location: { latitude: 0, longitude: 0 } };
const s2: Stage = { id: "s2", eventId: "e", name: "Doki", location: { latitude: 0, longitude: 0 } };

function concert(id: string, stageId: string, startsAt: string, endsAt: string): Concert {
  return { id, eventId: "e", stageId, artist: id, startsAt, endsAt };
}

const hanna = concert("Hanna Sieradz", "s2", "2027-07-02T21:30:00+02:00", "2027-07-02T22:30:00+02:00");
const mewy = concert("Mewy Nocą", "s1", "2027-07-02T22:15:00+02:00", "2027-07-02T23:30:00+02:00");
const wilga = concert("Wilga i Fale", "s1", "2027-07-02T20:15:00+02:00", "2027-07-02T21:30:00+02:00");

describe("formatTime", () => {
  it("formats in Europe/Warsaw regardless of the input offset", () => {
    expect(formatTime("2027-07-02T19:49:00Z")).toBe("21:49");
    expect(formatTime("2027-01-15T20:05:00Z")).toBe("21:05");
  });
});

describe("toPerformanceCardProps", () => {
  const now = new Date("2027-07-02T20:00:00+02:00");

  it("detects a conflict and builds the status line from the other concert", () => {
    expect(overlaps(hanna, mewy)).toBe(true);
    expect(overlaps(wilga, hanna)).toBe(false); // ends exactly when the other starts
    expect(findConflict(hanna, [wilga, mewy])).toBe(mewy);

    const props = toPerformanceCardProps(hanna, s2, { inPlan: true, conflictWith: { concert: mewy, stage: s1 }, now });
    expect(props.state).toBe("conflict");
    expect(props.statusLine).toBe("Kolizja · S1 od 22:15");
    expect(props).toMatchObject({ stage: "s2", stageName: "Doki", start: "21:30", end: "22:30" });
  });

  it("ignores a conflict when the concert is not in the plan", () => {
    const props = toPerformanceCardProps(hanna, s2, { inPlan: false, conflictWith: { concert: mewy, stage: s1 }, now });
    expect(props.state).toBe("default");
    expect(props.statusLine).toBeUndefined();
  });

  it("marks finished concerts as played", () => {
    const later = new Date("2027-07-02T21:31:00+02:00");
    expect(toPerformanceCardProps(wilga, s1, { inPlan: true, now: later }).state).toBe("played");
  });

  it("throws on stage ids outside s1–s3", () => {
    const odd: Stage = { ...s1, id: "uuid-123" };
    expect(() => toPerformanceCardProps(wilga, odd, { inPlan: false, now })).toThrow();
  });
});

describe("toNowPassProps", () => {
  it("computes remaining minutes and progress", () => {
    const trio = concert("Bursztyn Trio", "s2", "2027-07-02T19:40:00+02:00", "2027-07-02T20:40:00+02:00");
    const props = toNowPassProps(trio, s2, {
      inPlan: false,
      serial: "0702-S2-03",
      accentSuppressed: false,
      now: new Date("2027-07-02T20:03:00+02:00"),
    });
    expect(props.range).toBe("19:40–20:40");
    expect(props.remainingMin).toBe(37);
    expect(props.progress).toBeCloseTo(23 / 60);
  });
});

describe("transitKindOf", () => {
  it.each([
    ["2", "tram"],
    ["12", "tram"],
    ["13", "bus"],
    ["158", "bus"],
    ["N3", "night"],
    ["n8", "night"],
    ["SKM", "skm"],
    ["T5", "bus"],
  ] as const)("%s → %s", (route, kind) => {
    expect(transitKindOf(route)).toBe(kind);
  });
});

describe("toDepartureRowProps", () => {
  const now = new Date("2027-07-02T21:45:00+02:00");
  const base: Departure = {
    stopId: 1,
    routeName: "2",
    headsign: "Oliwa",
    departureAt: "2027-07-02T21:49:00+02:00",
    delaySeconds: 0,
    fetchedAt: "2027-07-02T21:40:00+02:00",
  };

  it("leave now when the walk eats the whole margin", () => {
    const props = toDepartureRowProps(base, 231, now);
    expect(props).toMatchObject({ kind: "tram", state: "leaveNow", time: "21:49", inMinutes: "4 min", freshness: "live" });
  });

  it("keeps a missed departure", () => {
    const props = toDepartureRowProps({ ...base, routeName: "SKM", departureAt: "2027-07-02T21:52:00+02:00" }, 462, now);
    expect(props.state).toBe("missed");
    expect(props.kind).toBe("skm");
  });

  it("gives a leave-at note inside 15 minutes", () => {
    const props = toDepartureRowProps({ ...base, routeName: "SKM", departureAt: "2027-07-02T22:07:00+02:00" }, 462, now);
    expect(props.state).toBe("leaveAt");
    expect(props.note).toBe("Wyjdź o 21:59");
  });

  it("adds the delay to the time and notes it for later departures", () => {
    const props = toDepartureRowProps(
      { ...base, routeName: "6", departureAt: "2027-07-02T22:03:00+02:00", delaySeconds: 300 },
      231,
      now,
    );
    expect(props).toMatchObject({ state: "later", time: "22:08", inMinutes: "23 min", note: "Opóźnienie · +5 min" });
  });

  it("without live data shows timetable time and „ok. N min”", () => {
    const props = toDepartureRowProps(
      { ...base, routeName: "N3", departureAt: "2027-07-02T23:58:00+02:00", delaySeconds: null },
      231,
      new Date("2027-07-02T23:50:00+02:00"),
    );
    expect(props).toMatchObject({ kind: "night", freshness: "stale", inMinutes: "ok. 8 min", note: "Nocny · 300 m" });
  });

  it("builds the stop meta from walking time", () => {
    expect(walkMeta(231)).toBe("300 m · 4 min");
  });
});

describe("toMessageBubbleProps", () => {
  const me = "u-me";
  const queued: OutboxMessage = {
    id: "m",
    crewId: "c",
    authorId: me,
    body: "Jestem pod S2 za 5 min.",
    status: "queued",
    attempts: 1,
    createdAt: "2027-07-02T21:10:00+02:00",
    nextAttemptAt: "2027-07-02T21:12:00+02:00",
    sentAt: null,
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is queued before 20 minutes and stale after", () => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date("2027-07-02T21:29:00+02:00"));
    const fresh = toMessageBubbleProps(queued, { currentUserId: me, staleAfterMin: 20 });
    expect(fresh.status).toBe("queued");
    expect(fresh.statusLabel).toBe("W kolejce · 21:10");

    jest.setSystemTime(new Date("2027-07-02T21:50:00+02:00"));
    const stale = toMessageBubbleProps(queued, { currentUserId: me, staleAfterMin: 20 });
    expect(stale.status).toBe("stale");
    expect(stale.statusLabel).toBe("Nieaktualna · 40 min w kolejce");
  });

  it("derives failed and sending", () => {
    const now = new Date("2027-07-02T21:15:00+02:00");
    expect(toMessageBubbleProps({ ...queued, nextAttemptAt: null }, { currentUserId: me, now }).status).toBe("failed");
    expect(
      toMessageBubbleProps(queued, { currentUserId: me, now, sendingIds: new Set(["m"]) }).status,
    ).toBe("sending");
  });

  it("maps sent own and crew messages", () => {
    const sent: OutboxMessage = { ...queued, status: "sent", sentAt: "2027-07-02T21:11:00+02:00" };
    expect(toMessageBubbleProps(sent, { currentUserId: me })).toMatchObject({
      author: "me",
      status: "sent",
      time: "21:11",
      statusLabel: "Wysłana 21:11",
    });

    const crew = toMessageBubbleProps(
      { ...sent, authorId: "u-kuba" },
      { currentUserId: me, authorNames: { "u-kuba": "Kuba" } },
    );
    expect(crew).toEqual({ id: "m", author: "crew", senderName: "Kuba", time: "21:11", text: sent.body });
  });
});
