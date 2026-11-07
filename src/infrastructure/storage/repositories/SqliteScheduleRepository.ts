import type { ScheduleItem } from "../../../domain/entities/Schedule";
import type { IScheduleRepository } from "../../../domain/repositories/IScheduleRepository";
import { getDb } from "../database";

interface ScheduleItemRow{
      user_id: string;
      concert_id: string;
      added_at: string;
    }

function toScheduleItem(row:ScheduleItemRow):ScheduleItem{
    return{
        userId: row.user_id,
        concertId: row.concert_id,
        addedAt: row.added_at
    }
}

export class SqliteScheduleRepository implements IScheduleRepository{
    async getForUser(userId: string): Promise<readonly ScheduleItem[]>{
        const db = await getDb()
        const rows = await db.getAllAsync<ScheduleItemRow>("SELECT user_id, concert_id, added_at FROM schedule_items WHERE user_id = ? ORDER BY added_at", [userId]) 
        return rows.map(toScheduleItem)
    }

    async add(item:ScheduleItem): Promise<void>{
        const db = await getDb()
        await db.runAsync("INSERT INTO schedule_items (user_id, concert_id, added_at) VALUES (?,?,?) ON CONFLICT(user_id, concert_id) DO NOTHING", [item.userId, item.concertId, item.addedAt])
    }

    async remove(userId: string, concertId: string): Promise<void>{
        const db = await getDb()
        await db.runAsync("DELETE FROM schedule_items WHERE user_id = ? AND concert_id = ?",[userId, concertId])
    }
}