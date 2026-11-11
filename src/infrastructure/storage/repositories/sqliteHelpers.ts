import type { SQLiteBindParams, SQLiteDatabase } from "expo-sqlite";
import type { Coordinates } from "../../../domain/entities/common";

export function toCoordinates(row: { latitude: number; longitude: number }): Coordinates {
    return { latitude: row.latitude, longitude: row.longitude }
}

export async function runForEach<T>(db: SQLiteDatabase,sql: string,items: readonly T[], toParams: (item: T) => SQLiteBindParams, ): Promise<void> {
    const statement = await db.prepareAsync(sql)
    try {
        for (const item of items) {
            await statement.executeAsync(toParams(item))
        }
    } finally {
        await statement.finalizeAsync()
    }
}
