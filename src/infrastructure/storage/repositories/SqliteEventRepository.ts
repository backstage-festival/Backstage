import type { BoundingBox } from "../../../domain/entities/common";
import type {
    Concert,
    EventPackage,
    FestivalEvent,
    Poi,
    PoiType,
    Stage,
} from "../../../domain/entities/Event";
import type { IEventRepository } from "../../../domain/repositories/IEventRepository";
import { getDb } from "../database";
import { runForEach, toCoordinates } from "./sqliteHelpers";

interface EventRow {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
    downloaded_at: string | null;
}

interface StageRow {
    id: string;
    event_id: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface ConcertRow {
    id: string;
    event_id: string;
    stage_id: string;
    artist: string;
    starts_at: string;
    ends_at: string;
}

interface PoiRow {
    id: string;
    event_id: string;
    type: PoiType;
    name: string;
    latitude: number;
    longitude: number;
}

function toEvent(row: EventRow): FestivalEvent {
    return {
        id: row.id,
        name: row.name,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        downloadedAt: row.downloaded_at,
    }
}

function toStage(row: StageRow): Stage {
    return {
        id: row.id,
        eventId: row.event_id,
        name: row.name,
        location: toCoordinates(row),
    }
}

function toConcert(row: ConcertRow): Concert {
    return {
        id: row.id,
        eventId: row.event_id,
        stageId: row.stage_id,
        artist: row.artist,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
    }
}

function toPoi(row: PoiRow): Poi {
    return {
        id: row.id,
        eventId: row.event_id,
        type: row.type,
        name: row.name,
        location: toCoordinates(row),
    }
}

export class SqliteEventRepository implements IEventRepository {
    async getCurrentEvent(): Promise<FestivalEvent | null> {
        const db = await getDb()
        const row = await db.getFirstAsync<EventRow>("SELECT id, name, starts_at, ends_at, downloaded_at FROM events WHERE downloaded_at IS NOT NULL ORDER BY downloaded_at DESC LIMIT 1", [])
        return row ? toEvent(row) : null
    }

    async getStages(eventId: string): Promise<readonly Stage[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<StageRow>("SELECT id, event_id, name, latitude, longitude FROM stages WHERE event_id = ? ORDER BY name", [eventId])
        return rows.map(toStage)
    }

    async getConcerts(eventId: string): Promise<readonly Concert[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<ConcertRow>("SELECT id, event_id, stage_id, artist, starts_at, ends_at FROM concerts WHERE event_id = ? ORDER BY starts_at", [eventId])
        return rows.map(toConcert)
    }

    async getPoisInBounds(eventId: string, bounds: BoundingBox): Promise<readonly Poi[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<PoiRow>("SELECT id, event_id, type, name, latitude, longitude FROM pois WHERE event_id = ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? ", [
            eventId,
            bounds.minLatitude,
            bounds.maxLatitude,
            bounds.minLongitude,
            bounds.maxLongitude,
        ])
        return rows.map(toPoi)
    }

    async saveEventPackage(eventPackage: EventPackage): Promise<void> {
        const { event, stages, concerts, pois } = eventPackage
        const db = await getDb()

        await db.withTransactionAsync(async () => {
            await db.runAsync("INSERT INTO events (id, name, starts_at, ends_at, downloaded_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, starts_at = excluded.starts_at, ends_at = excluded.ends_at, downloaded_at = excluded.downloaded_at", [
                event.id,
                event.name,
                event.startsAt,
                event.endsAt,
                event.downloadedAt,
            ])

            await runForEach(db, "INSERT INTO stages (id, event_id, name, latitude, longitude) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_id = excluded.event_id, name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude", stages, (stage) => [
                stage.id,
                stage.eventId,
                stage.name,
                stage.location.latitude,
                stage.location.longitude,
            ])

            await runForEach(db, "INSERT INTO concerts (id, event_id, stage_id, artist, starts_at, ends_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_id = excluded.event_id, stage_id = excluded.stage_id, artist = excluded.artist, starts_at = excluded.starts_at, ends_at = excluded.ends_at", concerts, (concert) => [
                concert.id,
                concert.eventId,
                concert.stageId,
                concert.artist,
                concert.startsAt,
                concert.endsAt,
            ])

            await runForEach(db, "INSERT INTO pois (id, event_id, type, name, latitude, longitude) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_id = excluded.event_id, type = excluded.type, name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude", pois, (poi) => [
                poi.id,
                poi.eventId,
                poi.type,
                poi.name,
                poi.location.latitude,
                poi.location.longitude,
            ])
            await db.runAsync("DELETE FROM concerts WHERE event_id = ? AND id NOT IN (SELECT value FROM json_each(?))", [event.id, JSON.stringify(concerts.map((concert) => concert.id))])
            await db.runAsync("DELETE FROM stages WHERE event_id = ? AND id NOT IN (SELECT value FROM json_each(?))", [event.id, JSON.stringify(stages.map((stage) => stage.id))])
            await db.runAsync("DELETE FROM pois WHERE event_id = ? AND id NOT IN (SELECT value FROM json_each(?))", [event.id, JSON.stringify(pois.map((poi) => poi.id))])
        })
    }
}
