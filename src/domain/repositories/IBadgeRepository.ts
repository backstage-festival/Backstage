import type { BadgeCode, EarnedBadge } from "../entities/Badge";
import type { IsoDateString } from "../entities/common";

export interface IBadgeRepository {
  getEarned(userId: string): Promise<readonly EarnedBadge[]>;
  saveEarned(
    userId: string,
    code: BadgeCode,
    earnedAt: IsoDateString,
  ): Promise<void>;
}
