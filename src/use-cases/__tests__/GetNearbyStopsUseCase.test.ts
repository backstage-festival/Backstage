import type { Stop } from "../../domain/entities/Transit";
import type { ILocationService } from "../../domain/repositories/ILocationService";
import type { ITransitRepository } from "../../domain/repositories/ITransitRepository";
import { boundingBoxAround } from "../../domain/utils/boundingBox";
import { GetNearbyStopsUseCase } from "../GetNearbyStopsUseCase";

const mainStage = { latitude: 54.3618, longitude: 18.6469 };
const box500 = boundingBoxAround(mainStage, 500);

const stop = (
  id: number,
  name: string,
  latitude: number,
  longitude: number,
): Stop => ({
  id,
  name,
  location: { latitude, longitude },
});

const placSolidarnosci = stop(14701, "Plac Solidarności", 54.3597, 18.6487);
const stoczniaSkm = stop(14702, "Stocznia SKM", 54.3655, 18.6453);
const closeGate = stop(14703, "Brama Stoczni", 54.3627, 18.6469);
const inBoxCorner = stop(
  14704,
  "Narożnik",
  box500.maxLatitude,
  box500.maxLongitude,
);

describe("GetNearbyStopsUseCase", () => {
  let transitRepo: jest.Mocked<ITransitRepository>;
  let gps: jest.Mocked<ILocationService>;
  let useCase: GetNearbyStopsUseCase;

  beforeEach(() => {
    transitRepo = {
      getStopsInBounds: jest
        .fn()
        .mockResolvedValue([
          stoczniaSkm,
          inBoxCorner,
          placSolidarnosci,
          closeGate,
        ]),
      saveStops: jest.fn(),
      getDepartures: jest.fn(),
      saveDepartures: jest.fn(),
      getAlerts: jest.fn(),
      saveAlerts: jest.fn(),
    };
    gps = {
      requestPermissions: jest.fn(),
      getCurrentPosition: jest.fn().mockResolvedValue(mainStage),
      watchPosition: jest.fn(),
      watchHeading: jest.fn(),
    };
    useCase = new GetNearbyStopsUseCase(transitRepo, gps);
  });

  it("asks the repository only for stops inside the bounding box", async () => {
    await useCase.execute();

    expect(transitRepo.getStopsInBounds).toHaveBeenCalledWith(box500);
  });

  it("returns the closest stops first with their distance", async () => {
    const stops = await useCase.execute();

    expect(stops.map((s) => [s.name, s.distanceMeters])).toEqual([
      ["Brama Stoczni", 100],
      ["Plac Solidarności", 261],
      ["Stocznia SKM", 424],
    ]);
  });

  it("drops a stop in the corner of the box that is further than the radius", async () => {
    const stops = await useCase.execute({ limit: 10 });

    expect(stops.map((s) => s.id)).not.toContain(inBoxCorner.id);
  });

  it("respects the radius and the limit", async () => {
    await expect(useCase.execute({ radiusMeters: 300 })).resolves.toHaveLength(
      2,
    );
    await expect(useCase.execute({ limit: 1 })).resolves.toHaveLength(1);
  });

  it("searches from a point given on the map without asking for GPS", async () => {
    const tent = { latitude: 54.3607, longitude: 18.6521 };

    await useCase.execute({ position: tent });

    expect(gps.getCurrentPosition).not.toHaveBeenCalled();
    expect(transitRepo.getStopsInBounds).toHaveBeenCalledWith(
      boundingBoxAround(tent, 500),
    );
  });

  it("throws LOCATION_UNAVAILABLE when there is no GPS position", async () => {
    gps.getCurrentPosition.mockResolvedValue(null);

    await expect(useCase.execute()).rejects.toMatchObject({
      code: "LOCATION_UNAVAILABLE",
    });
    expect(transitRepo.getStopsInBounds).not.toHaveBeenCalled();
  });

  it("returns an empty list when there are no stops nearby", async () => {
    transitRepo.getStopsInBounds.mockResolvedValue([]);

    await expect(useCase.execute()).resolves.toEqual([]);
  });
});
