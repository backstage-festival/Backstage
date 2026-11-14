import type { Concert } from "../domain/entities/Event";
import type { ScheduleItem } from "../domain/entities/Schedule";
import { DomainError } from "../domain/errors/DomainError";
import { ScheduleConflictError } from "../domain/errors/ScheduleConflictError";
import type { IEventRepository } from "../domain/repositories/IEventRepository";
import type { IScheduleRepository } from "../domain/repositories/IScheduleRepository";
import { findScheduleConflicts } from "../domain/utils/scheduleConflict";

export interface AddToScheduleInput {
  readonly userId: string;
  readonly eventId: string;
  readonly concertId: string;
  readonly allowConflict?: boolean;
}

export type AddToScheduleResult =
  | {
      readonly status: "added";
      readonly item: ScheduleItem;
      readonly conflicts: readonly Concert[];
    }
  | { readonly status: "already_planned" };

export class AddToScheduleUseCase {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly scheduleRepository: IScheduleRepository,
  ) {}

  async execute(input: AddToScheduleInput): Promise<AddToScheduleResult> {
    const [concerts, plannedItems] = await Promise.all([
      this.eventRepository.getConcerts(input.eventId),
      this.scheduleRepository.getForUser(input.userId),
    ]);

    const concert = concerts.find((c) => c.id === input.concertId);
    if (!concert) {
      throw new DomainError(
        "CONCERT_NOT_FOUND",
        `Concert ${input.concertId} not found.`,
      );
    }

    const plannedIds = new Set(plannedItems.map((item) => item.concertId));
    if (plannedIds.has(concert.id)) {
      return { status: "already_planned" };
    }

    const plannedConcerts = concerts.filter((c) => plannedIds.has(c.id));
    const conflicts = findScheduleConflicts(concert, plannedConcerts);

    if (conflicts.length > 0 && input.allowConflict !== true) {
      throw new ScheduleConflictError(conflicts);
    }

    const item: ScheduleItem = {
      userId: input.userId,
      concertId: concert.id,
      addedAt: new Date().toISOString(),
    };
    await this.scheduleRepository.add(item);

    return { status: "added", item, conflicts };
  }
}
