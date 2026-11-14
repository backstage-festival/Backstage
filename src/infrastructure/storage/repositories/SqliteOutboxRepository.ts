import type { IsoDateString } from "../../../domain/entities/common";
import type { OutboxMessage, OutboxStatus } from "../../../domain/entities/OutboxMessage";
import type { IOutboxRepository } from "../../../domain/repositories/IOutboxRepository";
import { getDb } from "../database";

interface OutboxMessageRow {
    id: string;
    crew_id: string;
    author_id: string;
    body: string;
    status: OutboxStatus; 
    attempts: number;
    created_at: string;
    next_attempt_at: string | null;
    sent_at: string | null;
}

function toOutboxMessage(row: OutboxMessageRow): OutboxMessage {
    return {
        id: row.id,
        crewId: row.crew_id,
        authorId: row.author_id,
        body: row.body,
        status: row.status,
        attempts: row.attempts,
        createdAt: row.created_at,
        nextAttemptAt: row.next_attempt_at,
        sentAt: row.sent_at,
    }
}

export class SqliteOutboxRepository implements IOutboxRepository {
    async enqueue(message: OutboxMessage): Promise<void> {
        const db = await getDb()
        await db.runAsync("INSERT INTO outbox_messages(id, crew_id, author_id, body, status, attempts, created_at, next_attempt_at, sent_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING", [
            message.id,
            message.crewId,
            message.authorId,
            message.body,
            message.status,
            message.attempts,
            message.createdAt,
            message.nextAttemptAt,
            message.sentAt,
        ])
    }

    async getQueued(): Promise<readonly OutboxMessage[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<OutboxMessageRow>("SELECT id, crew_id, author_id, body, status, attempts, created_at, next_attempt_at, sent_at FROM outbox_messages WHERE status='queued' ORDER BY created_at", [])
        return rows.map(toOutboxMessage)
    }

    async getForCrew(crewId: string): Promise<readonly OutboxMessage[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<OutboxMessageRow>("SELECT id, crew_id, author_id, body, status, attempts, created_at, next_attempt_at, sent_at FROM outbox_messages WHERE crew_id=? ORDER BY created_at ", [crewId])
        return rows.map(toOutboxMessage)
    }

    async markSent(id: string, sentAt: IsoDateString): Promise<void> {
        const db = await getDb()
        await db.runAsync("UPDATE outbox_messages SET status = 'sent', sent_at = ?, next_attempt_at = NULL WHERE id = ?", [sentAt, id])
    }

    async markFailed(id: string, attempts: number, nextAttemptAt: IsoDateString | null): Promise<void> {
        const db = await getDb()
        await db.runAsync("UPDATE outbox_messages SET attempts = ?, next_attempt_at = ? WHERE id = ?", [attempts, nextAttemptAt, id])
    }

    async resetAttempts(id: string): Promise<void> {
        const db = await getDb();
        await db.runAsync("UPDATE outbox_messages SET attempts = 0, next_attempt_at = NULL WHERE id = ?", [id]);
}
}
