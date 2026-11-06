import type { OutboxMessage } from "../entities/OutboxMessage";
import { DomainError } from "../errors/DomainError";
import { hasExhaustedRetries } from "./retryBackoff";

export const MESSAGE_STALE_AFTER_MS = 30 * 60_000;

export type MessageDeliveryState = "sent" | "failed" | "stale" | "queued";

type MessageTiming = Pick<OutboxMessage, "createdAt">;
type MessageForState = Pick<
  OutboxMessage,
  "status" | "attempts" | "nextAttemptAt" | "createdAt"
>;

export function getMessageAgeMs(
  message: MessageTiming,
  now: Date = new Date(),
): number {
  const createdMs = Date.parse(message.createdAt);
  if (Number.isNaN(createdMs)) {
    throw new DomainError(
      "INVALID_DATE",
      `Invalid date: ${message.createdAt}.`,
    );
  }
  return now.getTime() - createdMs;
}

export function isMessageStale(
  message: MessageTiming,
  now: Date = new Date(),
): boolean {
  return getMessageAgeMs(message, now) >= MESSAGE_STALE_AFTER_MS;
}

export function getMessageDeliveryState(
  message: MessageForState,
  now: Date = new Date(),
): MessageDeliveryState {
  if (message.status === "sent") return "sent";
  if (hasExhaustedRetries(message)) return "failed";
  if (message.attempts > 0 && message.nextAttemptAt === null) return "failed";
  if (isMessageStale(message, now)) return "stale";
  return "queued";
}
