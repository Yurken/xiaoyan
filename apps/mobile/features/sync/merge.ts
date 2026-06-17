import {
  CONSUMED_TABLES,
  effectiveTs,
  isConsumedTable,
  pkColumn,
  recordKey,
  splitRecordKey,
  type DeviceSnapshot,
} from "./types";
import type { DeleteRow, UpsertRow } from "./localStore";

export interface MergePlan {
  upserts: UpsertRow[];
  deletes: DeleteRow[];
}

/**
 * 多设备快照 + 本地时钟 → 合并计划（纯函数，无副作用）。
 * 规则与桌面端一致：按 (table, pk) 记录级 Last-Write-Wins（比较有效时钟），
 * 删除墓碑在 deleted_at >= 记录时钟 时取胜。本地时钟用于跳过无变化的写入。
 */
export function mergeSnapshots(snapshots: DeviceSnapshot[], localClocks: Map<string, string>): MergePlan {
  const winners = new Map<string, UpsertRow>();
  const tombstones = new Map<string, string>();

  for (const snapshot of snapshots) {
    for (const table of CONSUMED_TABLES) {
      const rows = snapshot.tables?.[table];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const pkValue = row[pkColumn(table)];
        if (typeof pkValue !== "string" || !pkValue) continue;
        const ts = effectiveTs(table, row);
        const key = recordKey(table, pkValue);
        const existing = winners.get(key);
        if (!existing || ts >= existing.ts) {
          winners.set(key, { table, pk: pkValue, ts, data: row });
        }
      }
    }
    for (const tombstone of snapshot.tombstones ?? []) {
      if (!isConsumedTable(tombstone.table) || !tombstone.id) continue;
      const key = recordKey(tombstone.table, tombstone.id);
      const existing = tombstones.get(key);
      if (!existing || tombstone.deleted_at > existing) tombstones.set(key, tombstone.deleted_at);
    }
  }

  const upserts: UpsertRow[] = [];
  const deletes: DeleteRow[] = [];

  for (const [key, row] of winners) {
    const deletedAt = tombstones.get(key);
    if (deletedAt && deletedAt >= row.ts) {
      if (localClocks.has(key)) deletes.push({ table: row.table, pk: row.pk });
      continue;
    }
    const localTs = localClocks.get(key);
    if (localTs === undefined || row.ts >= localTs) {
      upserts.push(row);
    }
  }

  // 墓碑指向「本地有、但本轮快照已无」的记录，也要删除。
  for (const [key, deletedAt] of tombstones) {
    if (winners.has(key)) continue;
    const localTs = localClocks.get(key);
    if (localTs !== undefined && deletedAt >= localTs) {
      deletes.push(splitRecordKey(key));
    }
  }

  return { upserts, deletes };
}
