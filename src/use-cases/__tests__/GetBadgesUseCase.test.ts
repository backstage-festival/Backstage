import type { Concert, FestivalEvent } from "../../domain/entities/Event";
import type { CheckIn } from "../../domain/entities/Schedule";
import type { IBadgeRepository } from "../../domain/repositories/IBadgeRepository";
import type { ICheckInRepository } from "../../domain/repositories/ICheckInRepository";
import type { IEventRepository } from "../../domain/repositories/IEventRepository";
import { GetBadgesUseCase } from "../GetBadgesUseCase";

const USER_ID = "user-1";
const EVENT_ID = "event-1";
const NOW = "2027-07-04T19:00:00.000Z";

const event: FestivalEvent = {
  id: EVENT_ID,
  name: "Stocznia Sound 2027",
  startsAt: "2027-07-02T12:00:00Z",
  endsAt: "2027-07-05T00:00:00Z",
  downloadedAt: "2027-07-01T18:00:00Z",
};

const concert = (
  id: string,
  stageId: string,
  startsAt: string,
  endsAt: string,
): Concert => ({
  id,
  eventId: EVENT_ID,
  stageId,
  artist: id,
  startsAt,
  endsAt,
});

const concerts: Concert[] = [
  concert("headliner", "main", "2027-07-02T21:15:00Z", "2027-07-02T22:30:00Z"),
  concert(
    "docks-day2",
    "docks",
    "2027-07-03T18:00:00Z",
    "2027-07-03T19:00:00Z",
  ),
  concert("tent-day3", "tent", "2027-07-04T17:00:00Z", "2027-07-04T18:00:00Z"),
  concert("main-day1", "main", "2027-07-02T16:00:00Z", "2027-07-02T17:00:00Z"),
];

const checkIn = (concertId: string): CheckIn => ({
  id: `ci-${concertId}`,
  userId: USER_ID,
  concertId,
  createdAt: "2027-07-02T16:30:00Z",
});

describe("GetBadgesUseCase", () => {
  let eventRepo: jest.Mocked<IEventRepository>;
  let checkInRepo: jest.Mocked<ICheckInRepository>;
  let badgeRepo: jest.Mocked<IBadgeRepository>;
  let useCase: GetBadgesUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));

    eventRepo = {
      getCurrentEvent: jest.fn().mockResolvedValue(event),
      getStages: jest.fn(),
      getConcerts: jest.fn().mockResolvedValue(concerts),
      getPoisInBounds: jest.fn(),
      saveEventPackage: jest.fn(),
    };
    checkInRepo = {
      getForUser: jest.fn().mockResolvedValue([]),
      exists: jest.fn(),
      save: jest.fn(),
    };
    badgeRepo = {
      getEarned: jest.fn().mockResolvedValue([]),
      saveEarned: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new GetBadgesUseCase(eventRepo, checkInRepo, badgeRepo);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns all four badges in a fixed order without a downloaded event", async () => {
    eventRepo.getCurrentEvent.mockResolvedValue(null);

    const badges = await useCase.execute({ userId: USER_ID });

    expect(badges.map((b) => b.code)).toEqual([
      "prepared",
      "night_owl",
      "all_three_days",
      "three_stages",
    ]);
    expect(badges.every((b) => !b.earned && b.earnedAt === null)).toBe(true);
    expect(eventRepo.getConcerts).not.toHaveBeenCalled();
    expect(badgeRepo.saveEarned).not.toHaveBeenCalled();
  });

  it("saves every newly earned badge with the current time", async () => {
    checkInRepo.getForUser.mockResolvedValue([
      checkIn("headliner"),
      checkIn("docks-day2"),
      checkIn("tent-day3"),
    ]);

    const badges = await useCase.execute({ userId: USER_ID });

    expect(badges.every((b) => b.earned && b.earnedAt === NOW)).toBe(true);
    expect(badgeRepo.saveEarned).toHaveBeenCalledTimes(4);
    expect(badgeRepo.saveEarned).toHaveBeenCalledWith(
      USER_ID,
      "night_owl",
      NOW,
    );
  });

  it("shows progress without saving badges that are not earned yet", async () => {
    eventRepo.getCurrentEvent.mockResolvedValue({
      ...event,
      downloadedAt: null,
    });
    checkInRepo.getForUser.mockResolvedValue([
      checkIn("main-day1"),
      checkIn("docks-day2"),
    ]);

    const badges = await useCase.execute({ userId: USER_ID });

    expect(badges.find((b) => b.code === "three_stages")).toEqual({
      code: "three_stages",
      progress: 2,
      goal: 3,
      earned: false,
      earnedAt: null,
    });
    expect(badgeRepo.saveEarned).not.toHaveBeenCalled();
  });

  it("keeps a saved badge even when the rule no longer grants it", async () => {
    eventRepo.getCurrentEvent.mockResolvedValue({
      ...event,
      downloadedAt: "2027-07-03T09:00:00Z",
    });
    badgeRepo.getEarned.mockResolvedValue([
      { code: "prepared", earnedAt: "2027-07-01T18:00:00Z" },
    ]);

    const badges = await useCase.execute({ userId: USER_ID });

    expect(badges[0]).toEqual({
      code: "prepared",
      progress: 1,
      goal: 1,
      earned: true,
      earnedAt: "2027-07-01T18:00:00Z",
    });
    expect(badgeRepo.saveEarned).not.toHaveBeenCalled();
  });

  it("propagates a save error", async () => {
    badgeRepo.saveEarned.mockRejectedValue(new Error("disk full"));

    await expect(useCase.execute({ userId: USER_ID })).rejects.toThrow(
      "disk full",
    );
  });
});
