import type { Coordinates } from "../domain/entities/common";
import type { Stop } from "../domain/entities/Transit";
import { DomainError } from "../domain/errors/DomainError";
import type { ILocationService } from "../domain/repositories/ILocationService";
import type { ITransitRepository } from "../domain/repositories/ITransitRepository";
import { boundingBoxAround } from "../domain/utils/boundingBox";
import { calculateDistanceInMeters } from "../domain/utils/distanceCalculator";

export const DEFAULT_STOP_RADIUS_METERS = 500;
export const DEFAULT_STOP_LIMIT = 3;

export interface GetNearbyStopsInput {
  /** Point to search from. When omitted, the current GPS position is used. */
  readonly position?: Coordinates;
  readonly radiusMeters?: number;
  readonly limit?: number;
}

export interface NearbyStop extends Stop {
  readonly distanceMeters: number;
}

export class GetNearbyStopsUseCase {
  constructor(
    private readonly transitRepository: ITransitRepository,
    private readonly locationService: ILocationService,
  ) {}

  async execute(input: GetNearbyStopsInput = {}): Promise<NearbyStop[]> {
    const radiusMeters = input.radiusMeters ?? DEFAULT_STOP_RADIUS_METERS;
    const limit = input.limit ?? DEFAULT_STOP_LIMIT;

    const position =
      input.position ?? (await this.locationService.getCurrentPosition());
    if (position === null) {
      throw new DomainError(
        "LOCATION_UNAVAILABLE",
        "Current location is unavailable.",
      );
    }

    const box = boundingBoxAround(position, radiusMeters);
    const candidates = await this.transitRepository.getStopsInBounds(box);

    return candidates
      .map((stop) => ({
        ...stop,
        distanceMeters: calculateDistanceInMeters(
          position.latitude,
          position.longitude,
          stop.location.latitude,
          stop.location.longitude,
        ),
      }))
      .filter((stop) => stop.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);
  }
}
