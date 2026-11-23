import type { Badge, BadgeProgress } from "../domain/entities/Badge";
import type { IBadgeRepository } from "../domain/repositories/IBadgeRepository";
import type { ICheckInRepository } from "../domain/repositories/ICheckInRepository";
import type { IEventRepository } from "../domain/repositories/IEventRepository";
import {
  evaluateAllDaysBadge,
  evaluateNightOwlBadge,
  evaluatePreparedBadge,
  evaluateThreeStagesBadge,
} from "../domain/utils/badgeRules";

export interface GetBadgesInput {
  readonly userId: string;
}

const NOT_PREPARED: BadgeProgress = {
  code: "prepared",
  progress: 0,
  goal: 1,
  earned: false,
};

export class GetBadgesUseCase {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly checkInRepository: ICheckInRepository,
    private readonly badgeRepository: IBadgeRepository,
  ) {}

  async execute(input: GetBadgesInput): Promise<readonly Badge[]> {
    const [event, checkIns, savedBadges] = await Promise.all([
      this.eventRepository.getCurrentEvent(),
      this.checkInRepository.getForUser(input.userId),
      this.badgeRepository.getEarned(input.userId),
    ]);
    const concerts =
      event === null ? [] : await this.eventRepository.getConcerts(event.id);

    const evaluated: readonly BadgeProgress[] = [
      event === null ? NOT_PREPARED : evaluatePreparedBadge(event),
      evaluateNightOwlBadge(checkIns, concerts),
      evaluateAllDaysBadge(checkIns, concerts),
      evaluateThreeStagesBadge(checkIns, concerts),
    ];

    const savedAtByCode = new Map(
      savedBadges.map((badge) => [badge.code, badge.earnedAt]),
    );
    const now = new Date().toISOString();
    const result: Badge[] = [];

    for (const badge of evaluated) {
      const savedAt = savedAtByCode.get(badge.code);

      if (savedAt !== undefined) {
        result.push({
          ...badge,
          progress: badge.goal,
          earned: true,
          earnedAt: savedAt,
        });
      } else if (badge.earned) {
        await this.badgeRepository.saveEarned(input.userId, badge.code, now);
        result.push({ ...badge, earnedAt: now });
      } else {
        result.push({ ...badge, earnedAt: null });
      }
    }

    return result;
  }
}
