import type { BoundingBox } from "../../../domain/entities/common";
import type { Departure, Stop, TransitAlert } from "../../../domain/entities/Transit";
import type { ITransitRepository } from "../../../domain/repositories/ITransitRepository";
import { getDb } from "../database";
import { runForEach, toCoordinates } from "./sqliteHelpers";

interface StopRow {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
}

interface DepartureRow {
    stop_id: number;
    route_name: string;
    headsign: string;
    departure_at: string;
    delay_seconds: number | null;
    fetched_at: string;
}

interface TransitAlertRow {
    id: string;
    title: string;
    body: string;
    valid_from: string;
    valid_to: string | null;
    fetched_at: string;
}

function toStop(row: StopRow): Stop {
    return { id: row.id, name: row.name, location: toCoordinates(row) }
}

function toDeparture(row: DepartureRow): Departure {
    return {
        stopId: row.stop_id,
        routeName: row.route_name,
        headsign: row.headsign,
        departureAt: row.departure_at,
        delaySeconds: row.delay_seconds,
        fetchedAt: row.fetched_at,
    }
}

function toTransitAlert(row: TransitAlertRow): TransitAlert {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        fetchedAt: row.fetched_at,
    }
}

export class SqliteTransitRepository implements ITransitRepository {
    async getStopsInBounds(bounds: BoundingBox): Promise<readonly Stop[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<StopRow>("SELECT id, name, latitude, longitude FROM stops WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? ", [
            bounds.minLatitude,
            bounds.maxLatitude,
            bounds.minLongitude,
            bounds.maxLongitude,
        ])
        return rows.map(toStop)
    }

    async saveStops(stops: readonly Stop[]): Promise<void> {
        const db = await getDb()
        await db.withTransactionAsync(async () => {
            await runForEach(db, "INSERT INTO stops (id, name, latitude, longitude) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude", stops, (stop) => [
                stop.id,
                stop.name,
                stop.location.latitude,
                stop.location.longitude,
            ])
        })
    }

    async getDepartures(stopId: number): Promise<readonly Departure[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<DepartureRow>("SELECT stop_id, route_name, headsign, departure_at, delay_seconds, fetched_at FROM departures WHERE stop_id = ? ORDER BY departure_at", [stopId])
        return rows.map(toDeparture)
    }

    async saveDepartures(stopId: number, departures: readonly Departure[]): Promise<void> {
        const db = await getDb()
        await db.withTransactionAsync(async () => {
            await db.runAsync("DELETE FROM departures WHERE stop_id = ?", [stopId])

            await runForEach(db, "INSERT INTO departures (stop_id, route_name, headsign, departure_at, delay_seconds, fetched_at) VALUES (?,?,?,?,?,?) ON CONFLICT(stop_id, route_name, departure_at) DO UPDATE SET headsign = excluded.headsign, delay_seconds = excluded.delay_seconds, fetched_at = excluded.fetched_at", departures, (departure) => [
                stopId,
                departure.routeName,
                departure.headsign,
                departure.departureAt,
                departure.delaySeconds,
                departure.fetchedAt,
            ])
        })
    }

    async getAlerts(): Promise<readonly TransitAlert[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<TransitAlertRow>("SELECT id, title, body, valid_from, valid_to, fetched_at FROM transit_alerts ORDER BY valid_from DESC", [])
        return rows.map(toTransitAlert)
    }

    async saveAlerts(alerts: readonly TransitAlert[]): Promise<void> {
        const db = await getDb()
        await db.withTransactionAsync(async () => {
            await db.runAsync("DELETE FROM transit_alerts", [])

            await runForEach(db, "INSERT INTO transit_alerts (id, title, body, valid_from, valid_to, fetched_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, valid_from = excluded.valid_from, valid_to = excluded.valid_to, fetched_at = excluded.fetched_at", alerts, (alert) => [
                alert.id,
                alert.title,
                alert.body,
                alert.validFrom,
                alert.validTo,
                alert.fetchedAt,
            ])
        })
    }
}
