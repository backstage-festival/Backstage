import type { Concert } from "../../domain/entities/Event";
import type { ScheduleItem } from "../../domain/entities/Schedule";
import { DomainError } from "../../domain/errors/DomainError";
import { ScheduleConflictError } from "../../domain/errors/ScheduleConflictError";
import type { IEventRepository } from "../../domain/repositories/IEventRepository";
import type { IScheduleRepository } from "../../domain/repositories/IScheduleRepository";
import { AddToScheduleUseCase } from "../AddToScheduleUseCase";

const EVENT_ID = "event-1";
const USER_ID = "user-1";

const concert = (
  id: string,
  artist: string,
  startsAt: string,
  endsAt: string,
): Concert => ({
  id,
  eventId: EVENT_ID,
  stageId: "stage-1",
  artist,
  startsAt,
  endsAt,
});

const neonTide = concert(
  "c1",
  "Neon Tide",
  "2027-07-02T16:00:00Z",
  "2027-07-02T17:00:00Z",
);
const rustChoir = concert(
  "c2",
  "Rust Choir",
  "2027-07-02T16:30:00Z",
  "2027-07-02T17:30:00Z",
);
const ferro = concert(
  "c3",
  "Ferro",
  "2027-07-02T17:00:00Z",
  "2027-07-02T18:00:00Z",
);

const planned = (concertId: string): ScheduleItem => ({
  userId: USER_ID,
  concertId,
  addedAt: "2027-07-01T10:00:00Z",
});

describe("AddToScheduleUseCase", () => {
  let eventRepo: jest.Mocked<IEventRepository>;
  let scheduleRepo: jest.Mocked<IScheduleRepository>;
  let useCase: AddToScheduleUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T12:00:00Z"));

    eventRepo = {
      getCurrentEvent: jest.fn(),
      getStages: jest.fn(),
      getConcerts: jest.fn().mockResolvedValue([neonTide, rustChoir, ferro]),
      getPoisInBounds: jest.fn(),
      saveEventPackage: jest.fn(),
    };
    scheduleRepo = {
      getForUser: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn(),
    };
    useCase = new AddToScheduleUseCase(eventRepo, scheduleRepo);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adds a concert to an empty plan with the current time", async () => {
    const result = await useCase.execute({
      userId: USER_ID,
      eventId: EVENT_ID,
      concertId: "c1",
    });

    const expectedItem = {
      userId: USER_ID,
      concertId: "c1",
      addedAt: "2027-07-02T12:00:00.000Z",
    };
    expect(result).toEqual({
      status: "added",
      item: expectedItem,
      conflicts: [],
    });
    expect(scheduleRepo.add).toHaveBeenCalledWith(expectedItem);
  });

  it("rejects an overlapping concert and does not save it", async () => {
    scheduleRepo.getForUser.mockResolvedValue([planned("c1")]);

    const promise = useCase.execute({
      userId: USER_ID,
      eventId: EVENT_ID,
      concertId: "c2",
    });

    await expect(promise).rejects.toBeInstanceOf(ScheduleConflictError);
    await expect(promise).rejects.toMatchObject({
      code: "SCHEDULE_CONFLICT",
      conflicts: [neonTide],
    });
    expect(scheduleRepo.add).not.toHaveBeenCalled();
  });

  it("adds an overlapping concert when the user confirms the conflict", async () => {
    scheduleRepo.getForUser.mockResolvedValue([planned("c1")]);

    const result = await useCase.execute({
      userId: USER_ID,
      eventId: EVENT_ID,
      concertId: "c2",
      allowConflict: true,
    });

    expect(result).toMatchObject({ status: "added", conflicts: [neonTide] });
    expect(scheduleRepo.add).toHaveBeenCalledTimes(1);
  });

  it("allows a concert that starts when the planned one ends", async () => {
    scheduleRepo.getForUser.mockResolvedValue([planned("c1")]);

    const result = await useCase.execute({
      userId: USER_ID,
      eventId: EVENT_ID,
      concertId: "c3",
    });

    expect(result).toMatchObject({ status: "added", conflicts: [] });
  });

  it("does nothing when the concert is already planned", async () => {
    scheduleRepo.getForUser.mockResolvedValue([planned("c1")]);

    const result = await useCase.execute({
      userId: USER_ID,
      eventId: EVENT_ID,
      concertId: "c1",
    });

    expect(result).toEqual({ status: "already_planned" });
    expect(scheduleRepo.add).not.toHaveBeenCalled();
  });

  it("throws CONCERT_NOT_FOUND for an unknown concert", async () => {
    const promise = useCase.execute({
      userId: USER_ID,
      eventId: EVENT_ID,
      concertId: "missing",
    });

    await expect(promise).rejects.toBeInstanceOf(DomainError);
    await expect(promise).rejects.toMatchObject({ code: "CONCERT_NOT_FOUND" });
    expect(scheduleRepo.add).not.toHaveBeenCalled();
  });

  it("passes a storage error on so the store can roll back", async () => {
    scheduleRepo.add.mockRejectedValue(new Error("SQLITE_BUSY"));

    await expect(
      useCase.execute({ userId: USER_ID, eventId: EVENT_ID, concertId: "c1" }),
    ).rejects.toThrow("SQLITE_BUSY");
  });
});
