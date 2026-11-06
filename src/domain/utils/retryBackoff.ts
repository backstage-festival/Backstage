import type { IsoDateString } from "../entities/common";
import type { OutboxMessage } from "../entities/OutboxMessage";
import { DomainError } from "../errors/DomainError";

export const RETRY_BASE_DELAY_MS = 5_000;
export const RETRY_MAX_DELAY_MS = 5 * 60_000;
export const MAX_AUTO_RETRY_ATTEMPTS = 8;

export function hasExhaustedRetries(
  message: Pick<OutboxMessage, "attempts">,
): boolean {
  return message.attempts >= MAX_AUTO_RETRY_ATTEMPTS;
}

export function getRetryDelayMs(attempts: number): number {
  if (!Number.isInteger(attempts) || attempts < 0) {
    throw new DomainError(
      "INVALID_RETRY_ATTEMPTS",
      `Invalid number of attempts: ${attempts}.`,
    );
  }
  if (attempts === 0) return 0;

  const delay = RETRY_BASE_DELAY_MS * 2 ** (attempts - 1);
  return Math.min(delay, RETRY_MAX_DELAY_MS);
}

export function calculateNextAttemptAt(
  attempts: number,
  now: Date = new Date(),
): IsoDateString | null {
  const delay = getRetryDelayMs(attempts);
  if (attempts >= MAX_AUTO_RETRY_ATTEMPTS) return null;
  return new Date(now.getTime() + delay).toISOString();
}
export function isDueForRetry(
  message: Pick<OutboxMessage, "status" | "attempts" | "nextAttemptAt">,
  now: Date = new Date(),
): boolean {
  if (message.status !== "queued") return false;
  if (hasExhaustedRetries(message)) return false;
  if (message.nextAttemptAt === null) return true;

  const nextMs = Date.parse(message.nextAttemptAt);
  if (Number.isNaN(nextMs)) {
    throw new DomainError(
      "INVALID_DATE",
      `Invalid date: ${message.nextAttemptAt}.`,
    );
  }
  return nextMs <= now.getTime();
}
