import type { OutboxMessage } from "../../domain/entities/OutboxMessage";
import type { IMessageGateway } from "../../domain/repositories/IMessageGateway";
import type { INetworkService } from "../../domain/repositories/INetworkService";
import type { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { MAX_AUTO_RETRY_ATTEMPTS } from "../../domain/utils/retryBackoff";
import { SyncOutboxUseCase } from "../SyncOutboxUseCase";

const message = (
  id: string,
  createdAt: string,
  overrides: Partial<OutboxMessage> = {},
): OutboxMessage => ({
  id,
  crewId: "crew-1",
  authorId: "user-1",
  body: id,
  status: "queued",
  attempts: 0,
  createdAt,
  nextAttemptAt: null,
  sentAt: null,
  ...overrides,
});

describe("SyncOutboxUseCase", () => {
  let outboxRepo: jest.Mocked<IOutboxRepository>;
  let gateway: jest.Mocked<IMessageGateway>;
  let network: jest.Mocked<INetworkService>;
  let useCase: SyncOutboxUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T22:00:00Z"));

    outboxRepo = {
      enqueue: jest.fn(),
      getQueued: jest.fn().mockResolvedValue([]),
      getForCrew: jest.fn(),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      resetAttempts: jest.fn(),
    };
    gateway = {
      send: jest.fn().mockResolvedValue(undefined),
      fetchForCrew: jest.fn(),
    };
    network = {
      isOnline: jest.fn().mockResolvedValue(true),
      onChange: jest.fn(),
    };

    useCase = new SyncOutboxUseCase(outboxRepo, gateway, network);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does nothing while offline", async () => {
    network.isOnline.mockResolvedValue(false);

    await expect(useCase.execute()).resolves.toEqual({
      offline: true,
      sentIds: [],
      failedId: null,
    });
    expect(outboxRepo.getQueued).not.toHaveBeenCalled();
    expect(gateway.send).not.toHaveBeenCalled();
  });

  it("sends due messages oldest first and marks them sent", async () => {
    const older = message("m1", "2027-07-02T21:50:00Z");
    const newer = message("m2", "2027-07-02T21:55:00Z");
    outboxRepo.getQueued.mockResolvedValue([newer, older]);

    const result = await useCase.execute();

    expect(result).toEqual({
      offline: false,
      sentIds: ["m1", "m2"],
      failedId: null,
    });
    expect(gateway.send.mock.calls.map(([sent]) => sent.id)).toEqual([
      "m1",
      "m2",
    ]);
    expect(outboxRepo.markSent).toHaveBeenCalledWith(
      "m1",
      "2027-07-02T22:00:00.000Z",
    );
  });

  it("schedules a retry after a failed send and stops to keep the order", async () => {
    outboxRepo.getQueued.mockResolvedValue([
      message("m1", "2027-07-02T21:50:00Z"),
      message("m2", "2027-07-02T21:55:00Z"),
    ]);
    gateway.send.mockRejectedValueOnce(new Error("Network request failed"));

    const result = await useCase.execute();

    expect(result).toEqual({ offline: false, sentIds: [], failedId: "m1" });
    expect(outboxRepo.markFailed).toHaveBeenCalledWith(
      "m1",
      1,
      "2027-07-02T22:00:05.000Z",
    );
    expect(gateway.send).toHaveBeenCalledTimes(1);
  });

  it("waits for the backoff time before sending again", async () => {
    const waiting = message("m1", "2027-07-02T21:50:00Z", {
      attempts: 1,
      nextAttemptAt: "2027-07-02T22:00:05Z",
    });
    outboxRepo.getQueued.mockResolvedValue([waiting]);

    await expect(useCase.execute()).resolves.toMatchObject({ sentIds: [] });
    expect(gateway.send).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5_000);

    await expect(useCase.execute()).resolves.toMatchObject({ sentIds: ["m1"] });
  });

  it("stops automatic retries after the last allowed attempt", async () => {
    outboxRepo.getQueued.mockResolvedValue([
      message("m1", "2027-07-02T21:50:00Z", {
        attempts: MAX_AUTO_RETRY_ATTEMPTS - 1,
        nextAttemptAt: "2027-07-02T21:59:00Z",
      }),
    ]);
    gateway.send.mockRejectedValue(new Error("timeout"));

    await useCase.execute();

    expect(outboxRepo.markFailed).toHaveBeenCalledWith(
      "m1",
      MAX_AUTO_RETRY_ATTEMPTS,
      null,
    );
  });

  it("skips a failed message so it does not block newer ones", async () => {
    outboxRepo.getQueued.mockResolvedValue([
      message("failed", "2027-07-02T21:00:00Z", {
        attempts: MAX_AUTO_RETRY_ATTEMPTS,
      }),
      message("m2", "2027-07-02T21:55:00Z"),
    ]);

    await expect(useCase.execute()).resolves.toMatchObject({ sentIds: ["m2"] });
    expect(gateway.send).toHaveBeenCalledTimes(1);
  });

  it("does not count a storage error as a failed send", async () => {
    outboxRepo.getQueued.mockResolvedValue([
      message("m1", "2027-07-02T21:50:00Z"),
    ]);
    outboxRepo.markSent.mockRejectedValue(new Error("SQLITE_BUSY"));

    await expect(useCase.execute()).rejects.toThrow("SQLITE_BUSY");
    expect(outboxRepo.markFailed).not.toHaveBeenCalled();
  });

  it("sends each message once when sync is triggered twice at the same time", async () => {
    outboxRepo.getQueued.mockResolvedValue([
      message("m1", "2027-07-02T21:50:00Z"),
    ]);

    const [first, second] = await Promise.all([
      useCase.execute(),
      useCase.execute(),
    ]);

    expect(first).toBe(second);
    expect(gateway.send).toHaveBeenCalledTimes(1);
  });
});
