import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import { selectDeliveryState } from "@/store/messageStore";

import { buildCrewItems, type CrewItemsInput } from "../crewItems";

const message = (id: string, createdAt: string, overrides: Partial<OutboxMessage> = {}): OutboxMessage => ({
  id,
  crewId: "crew",
  authorId: "me",
  body: id,
  status: "queued",
  attempts: 0,
  createdAt,
  nextAttemptAt: null,
  sentAt: null,
  ...overrides,
});

const friday = message("fri", "2027-07-02T21:02:00+02:00", { authorId: "kuba", status: "sent", sentAt: "2027-07-02T21:02:00+02:00" });
const stale = message("stale", "2027-07-02T21:10:00+02:00", { attempts: 2, nextAttemptAt: "2027-07-02T21:55:00+02:00" });
const saturday = message("sat", "2027-07-03T00:10:00+02:00");

const input = (overrides: Partial<CrewItemsInput> = {}): CrewItemsInput => ({
  messages: [friday, stale, saturday],
  currentUserId: "me",
  pendingIds: new Set(),
  now: new Date("2027-07-03T00:12:00+02:00"),
  deliveryStateOf: selectDeliveryState,
  senderName: "Ekipa",
  ...overrides,
});

describe("buildCrewItems", () => {
  it("lists newest first with a separator above each day", () => {
    expect(buildCrewItems(input()).map((item) => item.key)).toEqual(["sat", "day-2027-07-03", "stale", "fri", "day-2027-07-02"]);
    expect(buildCrewItems(input())[1]).toMatchObject({ type: "day", label: "Sob 3.07" });
  });

  it("takes the delivery state from the domain selector with the given clock", () => {
    const [, , staleItem, crewItem] = buildCrewItems(input());
    expect(staleItem).toMatchObject({ type: "message", bubble: { status: "stale", statusLabel: "Nieaktualna · 182 min w kolejce" } });
    expect(crewItem).toMatchObject({ type: "message", bubble: { author: "crew", senderName: "Ekipa" } });

    const earlier = buildCrewItems(input({ now: new Date("2027-07-02T21:20:00+02:00") }));
    expect(earlier[2]).toMatchObject({ bubble: { status: "queued" } });
  });

  it("shows a pending write as sending", () => {
    const items = buildCrewItems(input({ pendingIds: new Set(["stale"]) }));
    expect(items[2]).toMatchObject({ bubble: { status: "sending" } });
  });

  it("skips the separator for a message with a broken date", () => {
    const broken = message("broken", "not a date");
    expect(buildCrewItems(input({ messages: [broken] })).map((item) => item.key)).toEqual(["broken"]);
  });
});
