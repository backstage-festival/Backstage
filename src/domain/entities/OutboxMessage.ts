import type { IsoDateString } from "./common";

/** "stale" is not stored – it is derived by a domain rule from createdAt. */
export type OutboxStatus = "queued" | "sent";

export interface OutboxMessage {
  readonly id: string;
  readonly crewId: string;
  readonly authorId: string;
  readonly body: string;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly createdAt: IsoDateString;
  readonly nextAttemptAt: IsoDateString | null;
  readonly sentAt: IsoDateString | null;
}
