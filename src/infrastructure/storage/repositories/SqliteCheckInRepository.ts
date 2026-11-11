import type { CheckIn } from "../../../domain/entities/Schedule";
import type { ICheckInRepository} from "../../../domain/repositories/ICheckInRepository";
import { getDb } from "../database";

interface CheckInItemRow{
      id: string;
      user_id: string;
      concert_id: string;
      created_at: string;
    }

function toCheckIn(row:CheckInItemRow):CheckIn{
    return{
        id: row.id,
        userId: row.user_id,
        concertId: row.concert_id,
        createdAt: row.created_at
    }
}

export class SqliteCheckInRepository implements ICheckInRepository{
    async getForUser(userId: string): Promise<readonly CheckIn[]>{
        const db = await getDb()
        const rows = await db.getAllAsync<CheckInItemRow>("SELECT id, user_id, concert_id, created_at FROM check_ins WHERE user_id = ? ORDER BY created_at", [userId])
        return rows.map(toCheckIn)
    }

    async exists(userId: string, concertId: string): Promise<boolean>{
        const db = await getDb()
        const row = await db.getFirstAsync<{ found: number }>("SELECT EXISTS(SELECT 1 FROM check_ins WHERE user_id = ? AND concert_id = ?) AS found", [userId, concertId],
        )
        return row?.found === 1
    }

        async save(checkIn: CheckIn): Promise<void>{
        const db = await getDb()
        await db.runAsync("INSERT INTO check_ins (id, user_id, concert_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING", [checkIn.id, checkIn.userId, checkIn.concertId, checkIn.createdAt],
        )
    }
}