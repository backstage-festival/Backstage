import type { OutboxMessage } from "../../domain/entities/OutboxMessage";
import type { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { MAX_AUTO_RETRY_ATTEMPTS } from "../../domain/utils/retryBackoff";
import { RetryMessageUseCase } from "../RetryMessageUseCase";

const failedMessage: OutboxMessage = {
  id: "m1",
  crewId: "crew-1",
  authorId: "user-1",
  body: "Gdzie jesteście?",
  status: "queued",
  attempts: MAX_AUTO_RETRY_ATTEMPTS,
  createdAt: "2027-07-02T21:00:00Z",
  nextAttemptAt: null,
  sentAt: null,
};

describe("RetryMessageUseCase", () => {
  let outboxRepo: jest.Mocked<IOutboxRepository>;
  let useCase: RetryMessageUseCase;

  beforeEach(() => {
    outboxRepo = {
      enqueue: jest.fn(),
      getQueued: jest.fn().mockResolvedValue([failedMessage]),
      getForCrew: jest.fn(),
      markSent: jest.fn(),
      markFailed: jest.fn(),
      resetAttempts: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new RetryMessageUseCase(outboxRepo);
  });

  it("resets the attempts of a failed message", async () => {
    await useCase.execute("m1");

    expect(outboxRepo.resetAttempts).toHaveBeenCalledWith("m1");
  });

  it("throws MESSAGE_NOT_FOUND for a message that is not queued", async () => {
    await expect(useCase.execute("sent-or-missing")).rejects.toMatchObject({
      code: "MESSAGE_NOT_FOUND",
    });
    expect(outboxRepo.resetAttempts).not.toHaveBeenCalled();
  });
});
