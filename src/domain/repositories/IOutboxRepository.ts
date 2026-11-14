import type { IsoDateString } from "../entities/common";
import type { OutboxMessage } from "../entities/OutboxMessage";

export interface IOutboxRepository {
  enqueue(message: OutboxMessage): Promise<void>;
  getQueued(): Promise<readonly OutboxMessage[]>;
  getForCrew(crewId: string): Promise<readonly OutboxMessage[]>;
  markSent(id: string, sentAt: IsoDateString): Promise<void>;
  markFailed(
    id: string,
    attempts: number,
    nextAttemptAt: IsoDateString | null,
  ): Promise<void>;
  resetAttempts(id: string): Promise<void>;
}
