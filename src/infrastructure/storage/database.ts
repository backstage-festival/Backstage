import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { SCHEMA_V1, SCHEMA_VERSION } from "./schema";

const DATABASE_NAME = "backstage.db";

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function openDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await migrate(db);
  return db;
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  await db.withExclusiveTransactionAsync(async (txn) => {
    if (currentVersion < 1) {
      await txn.execAsync(SCHEMA_V1);
    }
    await txn.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}
