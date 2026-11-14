import type { CheckIn } from "../domain/entities/Schedule";
import { DomainError } from "../domain/errors/DomainError";
import { TooFarFromStageError } from "../domain/errors/TooFarFromStageError";
import type { ICheckInRepository } from "../domain/repositories/ICheckInRepository";
import type { IEventRepository } from "../domain/repositories/IEventRepository";
import type { IIdGenerator } from "../domain/repositories/IIdGenerator";
import type { ILocationService } from "../domain/repositories/ILocationService";
import { isCheckInOpen } from "../domain/utils/checkInWindow";
import { checkGeofence } from "../domain/utils/geofence";

export interface CheckInInput {
  readonly userId: string;
  readonly eventId: string;
  readonly concertId: string;
}

export type CheckInResult =
  | {
      readonly status: "checked_in";
      readonly checkIn: CheckIn;
      readonly distanceMeters: number;
    }
  | { readonly status: "already_checked_in" };

export class CheckInUseCase {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly checkInRepository: ICheckInRepository,
    private readonly locationService: ILocationService,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(input: CheckInInput): Promise<CheckInResult> {
    const [concerts, stages] = await Promise.all([
      this.eventRepository.getConcerts(input.eventId),
      this.eventRepository.getStages(input.eventId),
    ]);

    const concert = concerts.find((c) => c.id === input.concertId);
    if (!concert) {
      throw new DomainError(
        "CONCERT_NOT_FOUND",
        `Concert ${input.concertId} not found.`,
      );
    }

    const stage = stages.find((s) => s.id === concert.stageId);
    if (!stage) {
      throw new DomainError(
        "STAGE_NOT_FOUND",
        `Stage ${concert.stageId} not found.`,
      );
    }

    if (await this.checkInRepository.exists(input.userId, concert.id)) {
      return { status: "already_checked_in" };
    }

    const now = new Date();
    if (!isCheckInOpen(concert, now)) {
      throw new DomainError(
        "CHECK_IN_CLOSED",
        `Check-in for ${concert.artist} is closed.`,
      );
    }

    const position = await this.locationService.getCurrentPosition();
    if (position === null) {
      throw new DomainError(
        "LOCATION_UNAVAILABLE",
        "Current location is unavailable.",
      );
    }

    const { isInside, distanceMeters } = checkGeofence(
      position,
      stage.location,
    );
    if (!isInside) {
      throw new TooFarFromStageError(distanceMeters);
    }

    const checkIn: CheckIn = {
      id: this.idGenerator.generate(),
      userId: input.userId,
      concertId: concert.id,
      createdAt: now.toISOString(),
    };
    await this.checkInRepository.save(checkIn);

    return { status: "checked_in", checkIn, distanceMeters };
  }
}
