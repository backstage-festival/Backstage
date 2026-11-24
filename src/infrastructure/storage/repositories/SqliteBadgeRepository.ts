import type { BadgeCode, EarnedBadge } from "../../../domain/entities/Badge";
import type { IsoDateString } from "../../../domain/entities/common";
import type { IBadgeRepository } from "../../../domain/repositories/IBadgeRepository";
import { getDb } from "../database";

interface UserBadgeRow {
  code: string;
  earned_at: string;
}

export class SqliteBadgeRepository implements IBadgeRepository {
  async getEarned(userId: string): Promise<readonly EarnedBadge[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<UserBadgeRow>(
      `SELECT b.code, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = ? AND ub.earned_at IS NOT NULL`,
      [userId],
    );
    return rows.map((row) => ({
      code: row.code as BadgeCode,
      earnedAt: row.earned_at,
    }));
  }

  async saveEarned(
    userId: string,
    code: BadgeCode,
    earnedAt: IsoDateString,
  ): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO user_badges (user_id, badge_id, progress, earned_at)
       SELECT ?, b.id, b.goal, ?
       FROM badges b WHERE b.code = ?
       ON CONFLICT (user_id, badge_id)
       DO UPDATE SET progress = excluded.progress, earned_at = excluded.earned_at`,
      [userId, earnedAt, code],
    );
  }
}
