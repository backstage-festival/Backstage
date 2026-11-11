import type { OutboxMessage } from "../domain/entities/OutboxMessage";
import { DomainError } from "../domain/errors/DomainError";
import type { IIdGenerator } from "../domain/repositories/IIdGenerator";
import type { IOutboxRepository } from "../domain/repositories/IOutboxRepository";
import { MAX_MESSAGE_LENGTH, normalizeText } from "../domain/utils/textRules";

export interface QueueMessageInput {
  readonly crewId: string;
  readonly authorId: string;
  readonly body: string;
}

export class QueueMessageUseCase {
  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(input: QueueMessageInput): Promise<OutboxMessage> {
    const body = normalizeText(input.body, MAX_MESSAGE_LENGTH);
    if (body === null) {
      throw new DomainError(
        "INVALID_MESSAGE_BODY",
        `Message must be 1–${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    const message: OutboxMessage = {
      id: this.idGenerator.generate(),
      crewId: input.crewId,
      authorId: input.authorId,
      body,
      status: "queued",
      attempts: 0,
      createdAt: new Date().toISOString(),
      nextAttemptAt: null,
      sentAt: null,
    };

    await this.outboxRepository.enqueue(message);
    return message;
  }
}
