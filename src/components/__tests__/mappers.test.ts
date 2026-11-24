import type { Concert, Stage } from "@/domain/entities/Event";
import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { Departure } from "@/domain/entities/Transit";

import {
  FALLBACK_STAGE_ID,
  formatTime,
  leaveNowModeOf,
  messageStatusOf,
  toDepartureRowProps,
  toMessageBubbleProps,
  toNowPassProps,
  toPerformanceCardProps,
  transitKindOf,
  walkMeta,
  walkSecondsFor,
} from "../mappers";

const s1: Stage = { id: "s1", eventId: "e", name: "Główna", location: { latitude: 0, longitude: 0 } };
const s2: Stage = { id: "s2", eventId: "e", name: "Doki", location: { latitude: 0, longitude: 0 } };
const stageCodes = { s1: "s1", s2: "s2" } as const;

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

  it("never throws for an invalid date", () => {
    expect(formatTime("not a date")).toBe("–");
  });
});

describe("toPerformanceCardProps", () => {
  const now = new Date("2027-07-02T20:00:00+02:00");

  it("builds the status line from the conflicting concert given by the caller", () => {
    const props = toPerformanceCardProps(hanna, s2, { inPlan: true, stageCodes, conflictWith: { concert: mewy, stage: s1 }, now });
    expect(props.state).toBe("conflict");
    expect(props.statusLine).toBe("Kolizja · S1 od 22:15");
    expect(props).toMatchObject({ stage: "s2", stageName: "Doki", start: "21:30", end: "22:30" });
  });

  it("ignores a conflict when the concert is not in the plan", () => {
    const props = toPerformanceCardProps(hanna, s2, { inPlan: false, stageCodes, conflictWith: { concert: mewy, stage: s1 }, now });
    expect(props.state).toBe("default");
    expect(props.statusLine).toBeUndefined();
  });

  it("marks finished concerts as played", () => {
    const later = new Date("2027-07-02T21:31:00+02:00");
    expect(toPerformanceCardProps(wilga, s1, { inPlan: true, stageCodes, now: later }).state).toBe("played");
  });

  it("uses stage codes from options for non s1–s3 ids", () => {
    const main: Stage = { ...s1, id: "uuid-main" };
    const props = toPerformanceCardProps(wilga, main, { inPlan: false, stageCodes: { "uuid-main": "s3" }, now });
    expect(props.stage).toBe("s3");
  });

  it("falls back safely for an unknown stage (also in the conflict line)", () => {
    const unknown: Stage = { ...s2, id: "uuid-unknown", name: "Scena X" };
    const render = () =>
      toPerformanceCardProps(hanna, unknown, {
        inPlan: true,
        stageCodes,
        conflictWith: { concert: mewy, stage: { ...s1, id: "uuid-other" } },
        now,
      });
    expect(render).not.toThrow();
    const props = render();
    expect(props.stage).toBe(FALLBACK_STAGE_ID);
    expect(props.stageName).toBe("Scena X");
    expect(props.statusLine).toBe("Kolizja · S1 od 22:15");
  });
});

describe("toNowPassProps", () => {
  it("computes remaining minutes and progress", () => {
    const trio = concert("Bursztyn Trio", "s2", "2027-07-02T19:40:00+02:00", "2027-07-02T20:40:00+02:00");
    const props = toNowPassProps(trio, s2, {
      inPlan: false,
      serial: "0702-S2-03",
      accentSuppressed: false,
      stageCodes,
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

  it("maps a live departure with the given state", () => {
    const props = toDepartureRowProps(base, 231, "leaveNow", { now });
    expect(props).toMatchObject({ kind: "tram", state: "leaveNow", time: "21:49", inMinutes: "4 min", freshness: "live" });
    expect(props.note).toBeUndefined();
  });

  it("keeps a missed departure", () => {
    const props = toDepartureRowProps({ ...base, routeName: "SKM", departureAt: "2027-07-02T21:52:00+02:00" }, 462, "missed", { now });
    expect(props).toMatchObject({ state: "missed", kind: "skm", inMinutes: "7 min" });
  });

  it("gives a leave-at note", () => {
    const props = toDepartureRowProps({ ...base, routeName: "SKM", departureAt: "2027-07-02T22:07:00+02:00" }, 462, "leaveAt", { now });
    expect(props.note).toBe("Wyjdź o 21:59");
  });

  it("adds the delay to the time and notes it for later departures", () => {
    const props = toDepartureRowProps(
      { ...base, routeName: "6", departureAt: "2027-07-02T22:03:00+02:00", delaySeconds: 300 },
      231,
      "later",
      { now },
    );
    expect(props).toMatchObject({ state: "later", time: "22:08", inMinutes: "23 min", note: "Opóźnienie · +5 min" });
  });

  it("without live data shows timetable time and „ok. N min”", () => {
    const props = toDepartureRowProps(
      { ...base, routeName: "N3", departureAt: "2027-07-02T23:58:00+02:00", delaySeconds: null },
      231,
      "later",
      { now: new Date("2027-07-02T23:50:00+02:00") },
    );
    expect(props).toMatchObject({ kind: "night", freshness: "stale", inMinutes: "ok. 8 min", note: "Nocny · 300 m" });
  });

  it("with data older than the TTL ignores the live delay", () => {
    const props = toDepartureRowProps({ ...base, delaySeconds: 300 }, 231, "leaveNow", { now, timetableOnly: true });
    expect(props).toMatchObject({ freshness: "stale", time: "21:49", inMinutes: "ok. 4 min", note: "Tramwaj · 300 m" });
  });

  it("builds the stop meta from walking time", () => {
    expect(walkMeta(231)).toBe("300 m · 4 min");
    expect(walkSecondsFor(300)).toBe(231);
  });
});

describe("messageStatusOf", () => {
  it.each([
    ["sent", false, "sent"],
    ["sent", true, "sent"],
    ["queued", true, "sending"],
    ["stale", true, "sending"],
    ["failed", true, "sending"],
    ["queued", false, "queued"],
    ["stale", false, "stale"],
    ["failed", false, "failed"],
  ] as const)("%s, sending=%s → %s", (delivery, sending, status) => {
    expect(messageStatusOf(delivery, sending)).toBe(status);
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

  it("labels a queued message with its time", () => {
    const props = toMessageBubbleProps(queued, { currentUserId: me, deliveryState: "queued" });
    expect(props.status).toBe("queued");
    expect(props.statusLabel).toBe("W kolejce · 21:10");
  });

  it("labels a stale message with the minutes it waited", () => {
    const now = new Date("2027-07-02T21:50:00+02:00");
    const stale = toMessageBubbleProps(queued, { currentUserId: me, deliveryState: "stale", now });
    expect(stale.status).toBe("stale");
    expect(stale.statusLabel).toBe("Nieaktualna · 40 min w kolejce");
  });

  it("shows failed and sending from the given state", () => {
    expect(toMessageBubbleProps(queued, { currentUserId: me, deliveryState: "failed" })).toMatchObject({
      status: "failed",
      statusLabel: "Nie wysłano",
    });
    expect(toMessageBubbleProps(queued, { currentUserId: me, deliveryState: "stale", sending: true })).toMatchObject({
      status: "sending",
      statusLabel: "Wysyłanie…",
    });
  });

  it("maps sent own and crew messages", () => {
    const sent: OutboxMessage = { ...queued, status: "sent", sentAt: "2027-07-02T21:11:00+02:00" };
    expect(toMessageBubbleProps(sent, { currentUserId: me, deliveryState: "sent" })).toMatchObject({
      author: "me",
      status: "sent",
      time: "21:11",
      statusLabel: "Wysłana 21:11",
    });

    const crew = toMessageBubbleProps(
      { ...sent, authorId: "u-kuba" },
      { currentUserId: me, deliveryState: "sent", senderName: "Ekipa" },
    );
    expect(crew).toEqual({ id: "m", author: "crew", senderName: "Ekipa", time: "21:11", text: sent.body });
  });
});

describe("leaveNowModeOf", () => {
  it("maps the S10 setting to the C02 alert mode", () => {
    expect(leaveNowModeOf("sound")).toBe("soundAndVibration");
    expect(leaveNowModeOf("vibrate")).toBe("vibrationOnly");
    expect(leaveNowModeOf("muted")).toBe("muted");
  });
});
