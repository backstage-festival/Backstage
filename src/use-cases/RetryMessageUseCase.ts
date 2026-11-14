import { DomainError } from "../domain/errors/DomainError";
import type { IOutboxRepository } from "../domain/repositories/IOutboxRepository";

export class RetryMessageUseCase {
  constructor(private readonly outboxRepository: IOutboxRepository) {}

  async execute(messageId: string): Promise<void> {
    const queued = await this.outboxRepository.getQueued();
    if (!queued.some((message) => message.id === messageId)) {
      throw new DomainError(
        "MESSAGE_NOT_FOUND",
        `Queued message ${messageId} not found.`,
      );
    }
    await this.outboxRepository.resetAttempts(messageId);
  }
}
