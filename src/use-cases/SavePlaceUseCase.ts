import type { Coordinates } from "../domain/entities/common";
import type { SavedPlace, SavedPlaceType } from "../domain/entities/SavedPlace";
import { DomainError } from "../domain/errors/DomainError";
import type { IIdGenerator } from "../domain/repositories/IIdGenerator";
import type { ILocationService } from "../domain/repositories/ILocationService";
import type { ISavedPlaceRepository } from "../domain/repositories/ISavedPlaceRepository";
import { assertValidCoordinates } from "../domain/utils/geofence";
import {
  MAX_PLACE_LABEL_LENGTH,
  normalizeText,
} from "../domain/utils/textRules";

export interface SavePlaceInput {
  readonly userId: string;
  readonly label: string;
  readonly type: SavedPlaceType;
  readonly location?: Coordinates;
}

export interface SavePlaceResult {
  readonly place: SavedPlace;
  readonly replacedIds: readonly string[];
}

export class SavePlaceUseCase {
  constructor(
    private readonly placeRepository: ISavedPlaceRepository,
    private readonly locationService: ILocationService,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(input: SavePlaceInput): Promise<SavePlaceResult> {
    const label = normalizeText(input.label, MAX_PLACE_LABEL_LENGTH);
    if (label === null) {
      throw new DomainError(
        "INVALID_PLACE_LABEL",
        `Label must be 1–${MAX_PLACE_LABEL_LENGTH} characters.`,
      );
    }

    const location =
      input.location ?? (await this.locationService.getCurrentPosition());
    if (location === null) {
      throw new DomainError(
        "LOCATION_UNAVAILABLE",
        "Current location is unavailable.",
      );
    }
    assertValidCoordinates(location);

    const place: SavedPlace = {
      id: this.idGenerator.generate(),
      userId: input.userId,
      label,
      type: input.type,
      location,
      savedAt: new Date().toISOString(),
    };

    const previousTents =
      input.type === "tent"
        ? (await this.placeRepository.getForUser(input.userId)).filter(
            (saved) => saved.type === "tent",
          )
        : [];

    await this.placeRepository.save(place);

    for (const tent of previousTents) {
      await this.placeRepository.remove(tent.id);
    }

    return { place, replacedIds: previousTents.map((tent) => tent.id) };
  }
}
