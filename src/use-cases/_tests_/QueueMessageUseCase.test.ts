import type { IIdGenerator } from "../../domain/repositories/IIdGenerator";
import type { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { isDueForRetry } from "../../domain/utils/retryBackoff";
import { QueueMessageUseCase } from "../QueueMessageUseCase";

describe("QueueMessageUseCase", () => {
  let outboxRepo: jest.Mocked<IOutboxRepository>;
  let ids: jest.Mocked<IIdGenerator>;
  let useCase: QueueMessageUseCase;

  const input = {
    crewId: "crew-1",
    authorId: "user-1",
    body: "  Jestem pod Główną 🎸  ",
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T21:50:00Z"));

    outboxRepo = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      getQueued: jest.fn(),
      getForCrew: jest.fn(),
      markSent: jest.fn(),
      markFailed: jest.fn(),
    };
    ids = { generate: jest.fn().mockReturnValue("msg-1") };

    useCase = new QueueMessageUseCase(outboxRepo, ids);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("queues a trimmed message that has never been sent", async () => {
    const message = await useCase.execute(input);

    expect(message).toEqual({
      id: "msg-1",
      crewId: "crew-1",
      authorId: "user-1",
      body: "Jestem pod Główną 🎸",
      status: "queued",
      attempts: 0,
      createdAt: "2027-07-02T21:50:00.000Z",
      nextAttemptAt: null,
      sentAt: null,
    });
    expect(outboxRepo.enqueue).toHaveBeenCalledWith(message);
  });

  it("creates a message that the outbox sync sends right away", async () => {
    const message = await useCase.execute(input);

    expect(isDueForRetry(message)).toBe(true);
  });

  it.each(["", "   ", "x".repeat(501)])(
    "rejects an invalid body %p",
    async (body) => {
      await expect(useCase.execute({ ...input, body })).rejects.toMatchObject({
        code: "INVALID_MESSAGE_BODY",
      });
      expect(outboxRepo.enqueue).not.toHaveBeenCalled();
    },
  );

  it("passes a storage error on so the store can roll back", async () => {
    outboxRepo.enqueue.mockRejectedValue(new Error("SQLITE_BUSY"));

    await expect(useCase.execute(input)).rejects.toThrow("SQLITE_BUSY");
  });
});
