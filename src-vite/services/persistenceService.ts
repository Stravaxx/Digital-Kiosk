import fs from 'fs/promises';
import path from 'path';

export interface ScreenStorageRecord {
  deviceId: string;
  hostname: string;
  resolution: string;
  os: string;
  version: string;
  deviceToken: string;
  playlistId: string;
  layoutId: string;
  lastSeen: string;
}

const DATABASE_DIR = path.resolve(process.cwd(), 'database');
const JSON_DB_PATH = path.join(DATABASE_DIR, 'screens.json');
const SQLITE_DB_PATH = path.join(DATABASE_DIR, 'digital-signage.sqlite');

async function ensureDatabaseFolder(): Promise<void> {
  await fs.mkdir(DATABASE_DIR, { recursive: true });
}

async function readJsonScreens(): Promise<ScreenStorageRecord[]> {
  await ensureDatabaseFolder();
  try {
    const raw = await fs.readFile(JSON_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ScreenStorageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJsonScreens(rows: ScreenStorageRecord[]): Promise<void> {
  await ensureDatabaseFolder();
  await fs.writeFile(JSON_DB_PATH, JSON.stringify(rows, null, 2), 'utf-8');
}

async function withSQLite<T>(action: (db: any) => T | Promise<T>): Promise<T | null> {
  try {
    const sqliteModule = await import('better-sqlite3');
    const BetterSqlite3 = (sqliteModule as any).default ?? sqliteModule;
    await ensureDatabaseFolder();
    const db = new BetterSqlite3(SQLITE_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS screens (
        deviceId TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        resolution TEXT NOT NULL,
        os TEXT NOT NULL,
        version TEXT NOT NULL,
        deviceToken TEXT NOT NULL,
        playlistId TEXT NOT NULL,
        layoutId TEXT NOT NULL,
        lastSeen TEXT NOT NULL
      );
    `);

    try {
      return await action(db);
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function getAllScreensPersistent(): Promise<ScreenStorageRecord[]> {
  const sqliteRows = await withSQLite((db) => {
    const stmt = db.prepare('SELECT * FROM screens');
    return stmt.all() as ScreenStorageRecord[];
  });

  if (sqliteRows) {
    await writeJsonScreens(sqliteRows);
    return sqliteRows;
  }

  return readJsonScreens();
}

export async function upsertScreenPersistent(record: ScreenStorageRecord): Promise<ScreenStorageRecord> {
  const sqliteSaved = await withSQLite((db) => {
    const stmt = db.prepare(`
      INSERT INTO screens (deviceId, hostname, resolution, os, version, deviceToken, playlistId, layoutId, lastSeen)
      VALUES (@deviceId, @hostname, @resolution, @os, @version, @deviceToken, @playlistId, @layoutId, @lastSeen)
      ON CONFLICT(deviceId) DO UPDATE SET
        hostname = excluded.hostname,
        resolution = excluded.resolution,
        os = excluded.os,
        version = excluded.version,
        deviceToken = excluded.deviceToken,
        playlistId = excluded.playlistId,
        layoutId = excluded.layoutId,
        lastSeen = excluded.lastSeen
    `);

    stmt.run(record);
    return record;
  });

  if (sqliteSaved) {
    const all = await getAllScreensPersistent();
    await writeJsonScreens(all);
    return sqliteSaved;
  }

  const rows = await readJsonScreens();
  const idx = rows.findIndex((item) => item.deviceId === record.deviceId);
  const next = idx === -1 ? [...rows, record] : rows.map((item) => (item.deviceId === record.deviceId ? record : item));
  await writeJsonScreens(next);
  return record;
}

export async function getStorageBackendStatus(): Promise<{ sqliteEnabled: boolean; jsonPath: string; sqlitePath: string }> {
  const sqliteEnabled = Boolean(await withSQLite(() => true));
  return {
    sqliteEnabled,
    jsonPath: JSON_DB_PATH,
    sqlitePath: SQLITE_DB_PATH
  };
}
