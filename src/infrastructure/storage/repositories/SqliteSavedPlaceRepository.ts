import type { SavedPlace, SavedPlaceType } from "../../../domain/entities/SavedPlace";
import type { ISavedPlaceRepository } from "../../../domain/repositories/ISavedPlaceRepository";
import { getDb } from "../database";
import { toCoordinates } from "./sqliteHelpers";

interface SavedPlaceRow {
    id: string;
    user_id: string;
    label: string;
    type: SavedPlaceType;
    latitude: number;
    longitude: number;
    saved_at: string;
}

function toSavedPlace(row: SavedPlaceRow): SavedPlace {
    return {
        id: row.id,
        userId: row.user_id,
        label: row.label,
        type: row.type,
        location: toCoordinates(row),
        savedAt: row.saved_at,
    }
}

export class SqliteSavedPlaceRepository implements ISavedPlaceRepository {
    async getForUser(userId: string): Promise<readonly SavedPlace[]> {
        const db = await getDb()
        const rows = await db.getAllAsync<SavedPlaceRow>("SELECT id, user_id, label, type, latitude, longitude, saved_at FROM saved_places WHERE user_id = ? ORDER BY saved_at DESC", [userId])
        return rows.map(toSavedPlace)
    }

    async save(place: SavedPlace): Promise<void> {
        const db = await getDb()
        await db.runAsync("INSERT INTO saved_places (id, user_id, label, type, latitude, longitude, saved_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, type = excluded.type, latitude = excluded.latitude, longitude = excluded.longitude, saved_at = excluded.saved_at", [
            place.id,
            place.userId,
            place.label,
            place.type,
            place.location.latitude,
            place.location.longitude,
            place.savedAt,
        ])
    }

    async remove(id: string): Promise<void> {
        const db = await getDb()
        await db.runAsync("DELETE FROM saved_places WHERE id = ?", [id])
    }
}
