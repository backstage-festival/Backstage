import type { SavedPlace } from "../../domain/entities/SavedPlace";
import { DomainError } from "../../domain/errors/DomainError";
import type { IIdGenerator } from "../../domain/repositories/IIdGenerator";
import type { ILocationService } from "../../domain/repositories/ILocationService";
import type { ISavedPlaceRepository } from "../../domain/repositories/ISavedPlaceRepository";
import { SavePlaceUseCase } from "../SavePlaceUseCase";

const USER_ID = "user-1";
const here = { latitude: 54.3612, longitude: 18.6455 };

const savedPlace = (id: string, type: SavedPlace["type"]): SavedPlace => ({
  id,
  userId: USER_ID,
  label: id,
  type,
  location: { latitude: 54.36, longitude: 18.65 },
  savedAt: "2027-07-02T12:00:00Z",
});

describe("SavePlaceUseCase", () => {
  let placeRepo: jest.Mocked<ISavedPlaceRepository>;
  let gps: jest.Mocked<ILocationService>;
  let ids: jest.Mocked<IIdGenerator>;
  let useCase: SavePlaceUseCase;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-02T15:00:00Z"));

    placeRepo = {
      getForUser: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    gps = {
      requestPermissions: jest.fn(),
      getCurrentPosition: jest.fn().mockResolvedValue(here),
      watchPosition: jest.fn(),
      watchHeading: jest.fn(),
    };
    ids = { generate: jest.fn().mockReturnValue("place-1") };

    useCase = new SavePlaceUseCase(placeRepo, gps, ids);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("saves the current GPS position with a trimmed label", async () => {
    const result = await useCase.execute({
      userId: USER_ID,
      label: "  Zbiórka  ",
      type: "meeting_point",
    });

    const expected: SavedPlace = {
      id: "place-1",
      userId: USER_ID,
      label: "Zbiórka",
      type: "meeting_point",
      location: here,
      savedAt: "2027-07-02T15:00:00.000Z",
    };
    expect(result).toEqual({ place: expected, replacedIds: [] });
    expect(placeRepo.save).toHaveBeenCalledWith(expected);
  });

  it("uses a point picked on the map without asking for GPS", async () => {
    const picked = { latitude: 54.3634, longitude: 18.6502 };

    const result = await useCase.execute({
      userId: USER_ID,
      label: "Parking",
      type: "parking",
      location: picked,
    });

    expect(result.place.location).toEqual(picked);
    expect(gps.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("throws LOCATION_UNAVAILABLE when there is no GPS position", async () => {
    gps.getCurrentPosition.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: USER_ID, label: "Namiot", type: "tent" }),
    ).rejects.toMatchObject({ code: "LOCATION_UNAVAILABLE" });
    expect(placeRepo.save).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "x".repeat(41)])(
    "rejects an invalid label %p",
    async (label) => {
      await expect(
        useCase.execute({ userId: USER_ID, label, type: "other" }),
      ).rejects.toMatchObject({ code: "INVALID_PLACE_LABEL" });
      expect(gps.getCurrentPosition).not.toHaveBeenCalled();
      expect(placeRepo.save).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid coordinates", async () => {
    await expect(
      useCase.execute({
        userId: USER_ID,
        label: "X",
        type: "other",
        location: { latitude: 91, longitude: 18.6 },
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(placeRepo.save).not.toHaveBeenCalled();
  });

  it("replaces the previous tent and keeps other places", async () => {
    placeRepo.getForUser.mockResolvedValue([
      savedPlace("old-tent", "tent"),
      savedPlace("car", "parking"),
    ]);

    const result = await useCase.execute({
      userId: USER_ID,
      label: "Namiot",
      type: "tent",
    });

    expect(result.replacedIds).toEqual(["old-tent"]);
    expect(placeRepo.remove).toHaveBeenCalledTimes(1);
    expect(placeRepo.remove).toHaveBeenCalledWith("old-tent");
  });

  it("keeps the old tent when saving the new one fails", async () => {
    placeRepo.getForUser.mockResolvedValue([savedPlace("old-tent", "tent")]);
    placeRepo.save.mockRejectedValue(new Error("SQLITE_FULL"));

    await expect(
      useCase.execute({ userId: USER_ID, label: "Namiot", type: "tent" }),
    ).rejects.toThrow("SQLITE_FULL");
    expect(placeRepo.remove).not.toHaveBeenCalled();
  });
});
