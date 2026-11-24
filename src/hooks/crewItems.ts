/**
 * Pure Crew logic: messages → newest-first list items with day separators.
 * The delivery state comes from the store selector (domain rule).
 */
import { type MessageBubbleData, toMessageBubbleProps } from "@/components/mappers";
import type { OutboxMessage } from "@/domain/entities/OutboxMessage";
import type { MessageDeliveryState } from "@/domain/utils/messageStaleness";

import { dayKeyOf, dayLabel } from "./planRows";

export type CrewItem =
  | { readonly type: "message"; readonly key: string; readonly bubble: MessageBubbleData }
  | { readonly type: "day"; readonly key: string; readonly label: string };

export interface CrewItemsInput {
  /** Oldest first, as the store keeps them. */
  readonly messages: readonly OutboxMessage[];
  readonly currentUserId: string;
  readonly pendingIds: ReadonlySet<string>;
  readonly now: Date;
  readonly deliveryStateOf: (message: OutboxMessage, now: Date) => MessageDeliveryState;
  /** Shown above crew bubbles. */
  readonly senderName: string;
}

/**
 * Newest first for the inverted FlatList. A day separator follows the
 * oldest message of each day, so on screen it sits above that day.
 */
export function buildCrewItems(input: CrewItemsInput): readonly CrewItem[] {
  const { messages, currentUserId, pendingIds, now, deliveryStateOf, senderName } = input;
  const items: CrewItem[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message === undefined) continue;
    items.push({
      type: "message",
      key: message.id,
      bubble: toMessageBubbleProps(message, {
        currentUserId,
        deliveryState: deliveryStateOf(message, now),
        sending: pendingIds.has(message.id),
        now,
        senderName,
      }),
    });
    const day = safeDayKey(message.createdAt);
    const older = messages[i - 1];
    if (day !== null && (older === undefined || safeDayKey(older.createdAt) !== day)) {
      items.push({ type: "day", key: `day-${day}`, label: dayLabel(day) });
    }
  }
  return items;
}

function safeDayKey(iso: string): string | null {
  return Number.isNaN(Date.parse(iso)) ? null : dayKeyOf(iso);
}
