import type { Concert, Stage } from "@/domain/entities/Event";

import { toPlanNote } from "../usePlanScreen";

const stage = (id: string, name: string): Stage => ({ id, eventId: "e", name, location: { latitude: 0, longitude: 0 } });
const stages = [stage("main", "Główna"), stage("docks", "Doki"), stage("tent", "Namiot Elektro")];

const hanna: Concert = {
  id: "c-hanna",
  eventId: "e",
  stageId: "docks",
  artist: "Hanna Sieradz",
  startsAt: "2027-07-03T02:00:00+02:00",
  endsAt: "2027-07-03T03:00:00+02:00",
};

describe("toPlanNote", () => {
  it("shows a conflict in the short card format and the full sentence to TalkBack", () => {
    const note = toPlanNote({ kind: "conflict", concertId: "c-sodium", conflicts: [hanna] }, stages);
    expect(note).toEqual({
      concertId: "c-sodium",
      label: "Kolizja · S2 od 02:00",
      accessibilityLabel: "Kolizja z Hanna Sieradz, scena 2 Doki, od 02:00",
      tone: "warning",
      allowConflict: true,
    });
  });

  it("keeps the short text the same length whatever the artist name", () => {
    const long = { ...hanna, artist: "Orkiestra Bardzo Długiej Nazwy i Przyjaciele" };
    const note = toPlanNote({ kind: "conflict", concertId: "c-sodium", conflicts: [long] }, stages);
    expect(note?.label).toBe("Kolizja · S2 od 02:00");
    expect(note?.accessibilityLabel).toContain(long.artist);
  });

  it("falls back to S1 without the stage name for a stage missing from the line-up", () => {
    const elsewhere = { ...hanna, stageId: "unknown" };
    const note = toPlanNote({ kind: "conflict", concertId: "c-sodium", conflicts: [elsewhere] }, stages);
    expect(note).toMatchObject({
      label: "Kolizja · S1 od 02:00",
      accessibilityLabel: "Kolizja z Hanna Sieradz, scena 1, od 02:00",
    });
  });

  it("shows only „Kolizja” when the store gives no conflicting concert", () => {
    expect(toPlanNote({ kind: "conflict", concertId: "c-sodium", conflicts: [] }, stages)).toMatchObject({
      label: "Kolizja",
      accessibilityLabel: "Kolizja",
      allowConflict: true,
    });
  });

  it("maps write errors to a short tag text and a full sentence for TalkBack", () => {
    expect(toPlanNote({ kind: "saveFailed", concertId: "c1" }, stages)).toEqual({
      concertId: "c1",
      label: "Nie zapisano zmiany",
      accessibilityLabel: "Nie zapisano zmiany w planie. Spróbuj jeszcze raz.",
      tone: "error",
      allowConflict: false,
    });
    expect(toPlanNote({ kind: "removeFailed", concertId: "c1" }, stages)).toMatchObject({
      label: "Nie usunięto z planu",
      accessibilityLabel: "Nie usunięto koncertu z planu. Spróbuj jeszcze raz.",
    });
    expect(toPlanNote({ kind: "concertNotFound", concertId: "c1" }, stages)).toMatchObject({
      label: "Brak koncertu w line-upie",
      accessibilityLabel: "Nie ma tego koncertu w line-upie.",
    });
    expect(toPlanNote({ kind: "loadFailed" }, stages)).toMatchObject({
      concertId: null,
      label: "Nie wczytano planu",
      accessibilityLabel: "Nie wczytano Twojego planu.",
    });
  });

  it("keeps every tag text short enough for one line at 100 % (≤ 25 characters)", () => {
    const notes = [
      toPlanNote({ kind: "conflict", concertId: "c", conflicts: [hanna] }, stages),
      toPlanNote({ kind: "saveFailed", concertId: "c" }, stages),
      toPlanNote({ kind: "removeFailed", concertId: "c" }, stages),
      toPlanNote({ kind: "concertNotFound", concertId: "c" }, stages),
      toPlanNote({ kind: "loadFailed" }, stages),
    ];
    for (const note of notes) expect(note?.label.length).toBeLessThanOrEqual(25);
  });

  it("shows nothing for no error or a tap before the plan loaded", () => {
    expect(toPlanNote(null, stages)).toBeNull();
    expect(toPlanNote({ kind: "notLoaded" }, stages)).toBeNull();
  });
});
