import type { Concert, Stage } from "../../domain/entities/Event";
import { TooFarFromStageError } from "../../domain/errors/TooFarFromStageError";
import type { ICheckInRepository } from "../../domain/repositories/ICheckInRepository";
import type { IEventRepository } from "../../domain/repositories/IEventRepository";
import type { IIdGenerator } from "../../domain/repositories/IIdGenerator";
import type { ILocationService } from "../../domain/repositories/ILocationService";
import { CheckInUseCase } from "../CheckInUseCase";

const EVENT_ID = "event-1";
const USER_ID = "user-1";

const mainStage: Stage = {
  id: "s1",
  eventId: EVENT_ID,
  name: "Główna",
  location: { latitude: 54.3618, longitude: 18.6469 },
};

const concert: Concert = {
  id: "c1",
  eventId: EVENT_ID,
  stageId: "s1",
  artist: "Neon Tide",
  startsAt: "2027-07-02T20:00:00Z",
  endsAt: "2027-07-02T21:00:00Z",
};

const metersNorthOfStage = (meters: number) => ({
  latitude: mainStage.location.latitude + meters / 111195,
  longitude: mainStage.location.longitude,
});

describe("CheckInUseCase", () => {
  let eventRepo: jest.Mocked<IEventRepository>;
  let checkInRepo: jest.Mocked<ICheckInRepository>;
  let gps: jest.Mocked<ILocationService>;
  let ids: jest.Mocked<IIdGenerator>;
  let useCase: CheckInUseCase;

  const input = { userId: USER_ID, eventId: EVENT_ID, concertId: "c1" };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T20:30:00Z"));

    eventRepo = {
      getCurrentEvent: jest.fn(),
      getStages: jest.fn().mockResolvedValue([mainStage]),
      getConcerts: jest.fn().mockResolvedValue([concert]),
      getPoisInBounds: jest.fn(),
      saveEventPackage: jest.fn(),
    };
    checkInRepo = {
      getForUser: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn().mockResolvedValue(undefined),
    };
    gps = {
      requestPermissions: jest.fn(),
      getCurrentPosition: jest.fn().mockResolvedValue(metersNorthOfStage(10)),
      watchPosition: jest.fn(),
      watchHeading: jest.fn(),
    };
    ids = { generate: jest.fn().mockReturnValue("checkin-1") };

    useCase = new CheckInUseCase(eventRepo, checkInRepo, gps, ids);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("checks in when the user is at the stage during the concert", async () => {
    const result = await useCase.execute(input);

    const expected = {
      id: "checkin-1",
      userId: USER_ID,
      concertId: "c1",
      createdAt: "2027-07-02T20:30:00.000Z",
    };
    expect(result).toEqual({
      status: "checked_in",
      checkIn: expected,
      distanceMeters: 10,
    });
    expect(checkInRepo.save).toHaveBeenCalledWith(expected);
  });

  it("rejects a check-in further than 50 m and reports the distance", async () => {
    gps.getCurrentPosition.mockResolvedValue(metersNorthOfStage(120));

    const promise = useCase.execute(input);

    await expect(promise).rejects.toBeInstanceOf(TooFarFromStageError);
    await expect(promise).rejects.toMatchObject({
      code: "TOO_FAR_FROM_STAGE",
      distanceMeters: 120,
    });
    expect(checkInRepo.save).not.toHaveBeenCalled();
  });

  it("throws LOCATION_UNAVAILABLE when there is no GPS position", async () => {
    gps.getCurrentPosition.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: "LOCATION_UNAVAILABLE",
    });
    expect(checkInRepo.save).not.toHaveBeenCalled();
  });

  it("is closed before the window opens and does not ask for GPS", async () => {
    jest.setSystemTime(new Date("2027-07-02T19:44:59Z"));

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: "CHECK_IN_CLOSED",
    });
    expect(gps.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("closes once the concert has ended", async () => {
    jest.advanceTimersByTime(31 * 60_000);

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: "CHECK_IN_CLOSED",
    });
  });

  it("returns already_checked_in without using GPS or saving", async () => {
    checkInRepo.exists.mockResolvedValue(true);

    await expect(useCase.execute(input)).resolves.toEqual({
      status: "already_checked_in",
    });
    expect(gps.getCurrentPosition).not.toHaveBeenCalled();
    expect(checkInRepo.save).not.toHaveBeenCalled();
  });

  it("throws CONCERT_NOT_FOUND for an unknown concert", async () => {
    await expect(
      useCase.execute({ ...input, concertId: "missing" }),
    ).rejects.toMatchObject({ code: "CONCERT_NOT_FOUND" });
  });

  it("throws STAGE_NOT_FOUND when the concert's stage is missing", async () => {
    eventRepo.getStages.mockResolvedValue([]);

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: "STAGE_NOT_FOUND",
    });
  });
});
