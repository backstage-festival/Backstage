import type { Concert, Stage } from "../../domain/entities/Event";
import type { ScheduleItem } from "../../domain/entities/Schedule";
import type { IEventRepository } from "../../domain/repositories/IEventRepository";
import type { ILocationService } from "../../domain/repositories/ILocationService";
import type { IScheduleRepository } from "../../domain/repositories/IScheduleRepository";
import { CalculateLeaveTimeUseCase } from "../CalculateLeaveTimeUseCase";

const EVENT_ID = "event-1";
const USER_ID = "user-1";

const mainStage: Stage = {
  id: "s1",
  eventId: EVENT_ID,
  name: "Główna",
  location: { latitude: 54.3618, longitude: 18.6469 },
};

const concert = (id: string, startsAt: string, endsAt: string): Concert => ({
  id,
  eventId: EVENT_ID,
  stageId: "s1",
  artist: id,
  startsAt,
  endsAt,
});

const earlier = concert(
  "earlier",
  "2027-07-02T19:00:00Z",
  "2027-07-02T20:00:00Z",
);
const next = concert("next", "2027-07-02T20:30:00Z", "2027-07-02T21:30:00Z");
const later = concert("later", "2027-07-02T22:00:00Z", "2027-07-02T23:00:00Z");
const notPlanned = concert(
  "not-planned",
  "2027-07-02T20:10:00Z",
  "2027-07-02T21:00:00Z",
);

const planned = (concertId: string): ScheduleItem => ({
  userId: USER_ID,
  concertId,
  addedAt: "2027-07-01T10:00:00Z",
});

const metersNorthOfStage = (meters: number) => ({
  latitude: mainStage.location.latitude + meters / 111195,
  longitude: mainStage.location.longitude,
});

describe("CalculateLeaveTimeUseCase", () => {
  let eventRepo: jest.Mocked<IEventRepository>;
  let scheduleRepo: jest.Mocked<IScheduleRepository>;
  let gps: jest.Mocked<ILocationService>;
  let useCase: CalculateLeaveTimeUseCase;

  const input = { userId: USER_ID, eventId: EVENT_ID };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T20:00:00Z"));

    eventRepo = {
      getCurrentEvent: jest.fn(),
      getStages: jest.fn().mockResolvedValue([mainStage]),
      getConcerts: jest
        .fn()
        .mockResolvedValue([later, earlier, notPlanned, next]),
      getPoisInBounds: jest.fn(),
      saveEventPackage: jest.fn(),
    };
    scheduleRepo = {
      getForUser: jest
        .fn()
        .mockResolvedValue([
          planned("earlier"),
          planned("next"),
          planned("later"),
        ]),
      add: jest.fn(),
      remove: jest.fn(),
    };
    gps = {
      requestPermissions: jest.fn(),
      getCurrentPosition: jest.fn().mockResolvedValue(metersNorthOfStage(600)),
      watchPosition: jest.fn(),
      watchHeading: jest.fn(),
    };

    useCase = new CalculateLeaveTimeUseCase(eventRepo, scheduleRepo, gps);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calculates when to leave for the next planned concert", async () => {
    const alert = await useCase.execute(input);

    expect(alert).toMatchObject({
      concert: next,
      stage: mainStage,
      distanceMeters: 600,
      walkSeconds: 500,
      status: "wait",
      leaveAt: "2027-07-02T20:16:40.000Z",
      secondsUntilLeave: 1000,
    });
  });

  it("uses the alert lead time from the user's settings", async () => {
    const alert = await useCase.execute({ ...input, bufferMinutes: 10 });

    expect(alert?.leaveAt).toBe("2027-07-02T20:11:40.000Z");
  });

  it("switches to leave_now when the leave time comes", async () => {
    jest.advanceTimersByTime(1000 * 1000);

    await expect(useCase.execute(input)).resolves.toMatchObject({
      status: "leave_now",
    });
  });

  it("moves on to the following concert once the next one has started", async () => {
    jest.setSystemTime(new Date("2027-07-02T20:31:00Z"));

    await expect(useCase.execute(input)).resolves.toMatchObject({
      concert: later,
    });
  });

  it("returns null without using GPS when nothing planned is ahead", async () => {
    jest.setSystemTime(new Date("2027-07-02T22:30:00Z"));

    await expect(useCase.execute(input)).resolves.toBeNull();
    expect(gps.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("throws LOCATION_UNAVAILABLE when there is no GPS position", async () => {
    gps.getCurrentPosition.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: "LOCATION_UNAVAILABLE",
    });
  });

  it("throws STAGE_NOT_FOUND when the concert's stage is missing", async () => {
    eventRepo.getStages.mockResolvedValue([]);

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: "STAGE_NOT_FOUND",
    });
  });
});
