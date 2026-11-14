import type { Concert, Stage } from "../domain/entities/Event";
import { DomainError } from "../domain/errors/DomainError";
import type { IEventRepository } from "../domain/repositories/IEventRepository";
import type { ILocationService } from "../domain/repositories/ILocationService";
import type { IScheduleRepository } from "../domain/repositories/IScheduleRepository";
import { calculateDistanceInMeters } from "../domain/utils/distanceCalculator";
import {
  DEFAULT_BUFFER_SECONDS,
  calculateLeaveNow,
  type LeaveNowResult,
} from "../domain/utils/leaveNowCalculator";

export interface CalculateLeaveTimeInput {
  readonly userId: string;
  readonly eventId: string;
  /** Alert lead time from the user's settings (5, 10 or 15 min). */
  readonly bufferMinutes?: number;
}

export interface LeaveTimeAlert extends LeaveNowResult {
  readonly concert: Concert;
  readonly stage: Stage;
  readonly distanceMeters: number;
}

export class CalculateLeaveTimeUseCase {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly scheduleRepository: IScheduleRepository,
    private readonly locationService: ILocationService,
  ) {}

  async execute(
    input: CalculateLeaveTimeInput,
  ): Promise<LeaveTimeAlert | null> {
    const [concerts, stages, plannedItems] = await Promise.all([
      this.eventRepository.getConcerts(input.eventId),
      this.eventRepository.getStages(input.eventId),
      this.scheduleRepository.getForUser(input.userId),
    ]);

    const now = new Date();
    const plannedIds = new Set(plannedItems.map((item) => item.concertId));
    const nextConcert = concerts
      .filter(
        (c) => plannedIds.has(c.id) && Date.parse(c.startsAt) > now.getTime(),
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];

    if (nextConcert === undefined) return null;

    const stage = stages.find((s) => s.id === nextConcert.stageId);
    if (!stage) {
      throw new DomainError(
        "STAGE_NOT_FOUND",
        `Stage ${nextConcert.stageId} not found.`,
      );
    }

    const position = await this.locationService.getCurrentPosition();
    if (position === null) {
      throw new DomainError(
        "LOCATION_UNAVAILABLE",
        "Current location is unavailable.",
      );
    }

    const distanceMeters = calculateDistanceInMeters(
      position.latitude,
      position.longitude,
      stage.location.latitude,
      stage.location.longitude,
    );

    const leave = calculateLeaveNow(
      {
        startsAt: nextConcert.startsAt,
        distanceMeters,
        bufferSeconds:
          input.bufferMinutes === undefined
            ? DEFAULT_BUFFER_SECONDS
            : input.bufferMinutes * 60,
      },
      now,
    );

    return { ...leave, concert: nextConcert, stage, distanceMeters };
  }
}
