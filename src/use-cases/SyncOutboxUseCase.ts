import type { OutboxMessage } from "../domain/entities/OutboxMessage";
import type { IMessageGateway } from "../domain/repositories/IMessageGateway";
import type { INetworkService } from "../domain/repositories/INetworkService";
import type { IOutboxRepository } from "../domain/repositories/IOutboxRepository";
import {
  calculateNextAttemptAt,
  hasExhaustedRetries,
  isDueForRetry,
} from "../domain/utils/retryBackoff";

export interface SyncOutboxResult {
  readonly offline: boolean;
  readonly sentIds: readonly string[];
  readonly failedId: string | null;
}

const byCreatedAt = (a: OutboxMessage, b: OutboxMessage): number =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

export class SyncOutboxUseCase {
  private inFlight: Promise<SyncOutboxResult> | null = null;

  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly messageGateway: IMessageGateway,
    private readonly networkService: INetworkService,
  ) {}

  execute(): Promise<SyncOutboxResult> {
    if (this.inFlight === null) {
      this.inFlight = this.sync().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async sync(): Promise<SyncOutboxResult> {
    if (!(await this.networkService.isOnline())) {
      return { offline: true, sentIds: [], failedId: null };
    }

    const queued = [...(await this.outboxRepository.getQueued())].sort(
      byCreatedAt,
    );
    const sentIds: string[] = [];

    for (const message of queued) {
      if (hasExhaustedRetries(message)) continue;
      if (!isDueForRetry(message, new Date())) break;

      try {
        await this.messageGateway.send(message);
      } catch {
        const attempts = message.attempts + 1;
        await this.outboxRepository.markFailed(
          message.id,
          attempts,
          calculateNextAttemptAt(attempts, new Date()),
        );
        return { offline: false, sentIds, failedId: message.id };
      }

      await this.outboxRepository.markSent(
        message.id,
        new Date().toISOString(),
      );
      sentIds.push(message.id);
    }

    return { offline: false, sentIds, failedId: null };
  }
}
