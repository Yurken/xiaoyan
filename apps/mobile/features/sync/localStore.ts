import * as SQLite from "expo-sqlite";

// 移动端本地缓存库。存储格式是移动端私有事项（只要同步「线格式」与桌面端一致即可），
// 因此用一张通用 sync_records 表存整行 JSON，避免逐表复刻桌面 schema。

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("xiaoyan-sync.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sync_records (
      table_name TEXT NOT NULL,
      pk         TEXT NOT NULL,
      ts         TEXT NOT NULL DEFAULT '',
      data       TEXT NOT NULL,
      PRIMARY KEY (table_name, pk)
    );
    CREATE INDEX IF NOT EXISTS idx_sync_records_table ON sync_records(table_name, ts DESC);
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export interface UpsertRow {
  table: string;
  pk: string;
  ts: string;
  data: Record<string, unknown>;
}

export interface DeleteRow {
  table: string;
  pk: string;
}

/** 在单个事务内应用一批 upsert 与删除，返回实际生效条数。 */
export async function applyChanges(upserts: UpsertRow[], deletes: DeleteRow[]): Promise<{ applied: number; deleted: number }> {
  const db = await getDb();
  let applied = 0;
  let deleted = 0;
  await db.withTransactionAsync(async () => {
    for (const row of upserts) {
      await db.runAsync(
        `INSERT INTO sync_records (table_name, pk, ts, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(table_name, pk) DO UPDATE SET ts = excluded.ts, data = excluded.data`,
        row.table,
        row.pk,
        row.ts,
        JSON.stringify(row.data),
      );
      applied += 1;
    }
    for (const row of deletes) {
      const result = await db.runAsync("DELETE FROM sync_records WHERE table_name = ? AND pk = ?", row.table, row.pk);
      deleted += result.changes ?? 0;
    }
  });
  return { applied, deleted };
}

/** 读取本地已存的某表所有记录的 (pk → ts)，供合并时比较时钟。 */
export async function getLocalClocks(table: string): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ pk: string; ts: string }>(
    "SELECT pk, ts FROM sync_records WHERE table_name = ?",
    table,
  );
  return new Map(rows.map((r) => [r.pk, r.ts]));
}

/** 按表读取记录（按时钟倒序），解析为对象数组。 */
export async function getRecords<T = Record<string, unknown>>(table: string): Promise<T[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    "SELECT data FROM sync_records WHERE table_name = ? ORDER BY ts DESC",
    table,
  );
  return rows.map((r) => JSON.parse(r.data) as T);
}

/** 读取单条记录。 */
export async function getRecord<T = Record<string, unknown>>(table: string, pk: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(
    "SELECT data FROM sync_records WHERE table_name = ? AND pk = ?",
    table,
    pk,
  );
  return row ? (JSON.parse(row.data) as T) : null;
}

export async function countRecords(table: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sync_records WHERE table_name = ?",
    table,
  );
  return row?.n ?? 0;
}

export async function metaGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key = ?", key);
  return row?.value ?? null;
}

export async function metaSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}
