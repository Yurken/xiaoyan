import type { ExperimentSnapshot } from "@research-copilot/types";

// ── Snapshot diff types ────────────────────────────────────────────

export interface JsonDiffEntry {
  key: string;
  kind: "added" | "removed" | "changed";
  oldValue?: unknown;
  newValue?: unknown;
}

export interface TextDiffLine {
  type: "same" | "add" | "remove";
  text: string;
}

export interface SnapshotDiffResult {
  config: JsonDiffEntry[];
  result: TextDiffLine[];
  notes: TextDiffLine[];
  env: JsonDiffEntry[];
  meta: MetaDiffEntry[];
}

export interface MetaDiffEntry {
  field: string;
  label: string;
  left: string;
  right: string;
  changed: boolean;
}

export type CompareDimension = "config" | "result" | "notes" | "env" | "meta";

export const DIMENSION_LABELS: Record<CompareDimension, string> = {
  config: "配置",
  result: "结果",
  notes: "备注",
  env: "环境变量",
  meta: "元信息",
};

// ── JSON diff ──────────────────────────────────────────────────────

/** Recursively compute a flat diff between two JSON-compatible objects. */
export function computeJsonDiff(
  oldObj: Record<string, unknown> | undefined | null,
  newObj: Record<string, unknown> | undefined | null,
  prefix = "",
): JsonDiffEntry[] {
  const oldMap = oldObj && typeof oldObj === "object" ? oldObj : {};
  const newMap = newObj && typeof newObj === "object" ? newObj : {};
  const allKeys = Array.from(new Set([...Object.keys(oldMap), ...Object.keys(newMap)])).sort();

  const entries: JsonDiffEntry[] = [];

  for (const key of allKeys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const oldVal = oldMap[key];
    const newVal = newMap[key];

    if (!(key in oldMap)) {
      entries.push({ key: fullKey, kind: "added", newValue: newVal });
    } else if (!(key in newMap)) {
      entries.push({ key: fullKey, kind: "removed", oldValue: oldVal });
    } else if (typeof oldVal === "object" && typeof newVal === "object" && oldVal !== null && newVal !== null && !Array.isArray(oldVal) && !Array.isArray(newVal)) {
      entries.push(...computeJsonDiff(oldVal as Record<string, unknown>, newVal as Record<string, unknown>, fullKey));
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      entries.push({ key: fullKey, kind: "changed", oldValue: oldVal, newValue: newVal });
    }
  }

  return entries;
}

// ── Text line diff (LCS-based, same algorithm as submission/shared.ts) ──

export function computeLineDiff(oldText: string, newText: string): TextDiffLine[] {
  const beforeLines = oldText.split("\n");
  const afterLines = newText.split("\n");
  const bc = beforeLines.length;
  const ac = afterLines.length;

  const dp: number[][] = Array.from({ length: bc + 1 }, () => new Array(ac + 1).fill(0));
  for (let i = 1; i <= bc; i++) {
    for (let j = 1; j <= ac; j++) {
      dp[i][j] =
        beforeLines[i - 1] === afterLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: TextDiffLine[] = [];
  let i = bc;
  let j = ac;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      result.unshift({ type: "same", text: beforeLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "add", text: afterLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: "remove", text: beforeLines[i - 1] });
      i--;
    }
  }
  return result;
}

// ── Snapshot comparison ────────────────────────────────────────────

export function compareSnapshots(left: ExperimentSnapshot, right: ExperimentSnapshot): SnapshotDiffResult {
  return {
    config: computeJsonDiff(left.configSnapshot, right.configSnapshot),
    result: computeLineDiff(left.resultSnapshot ?? "", right.resultSnapshot ?? ""),
    notes: computeLineDiff(left.notesSnapshot ?? "", right.notesSnapshot ?? ""),
    env: computeJsonDiff(left.envSnapshot, right.envSnapshot),
    meta: computeMetaDiff(left, right),
  };
}

function metaField(label: string, leftVal: string, rightVal: string): MetaDiffEntry {
  return {
    field: label,
    label,
    left: leftVal || "—",
    right: rightVal || "—",
    changed: leftVal !== rightVal,
  };
}

function computeMetaDiff(left: ExperimentSnapshot, right: ExperimentSnapshot): MetaDiffEntry[] {
  return [
    metaField("标题", left.title, right.title),
    metaField("工具", left.toolId ?? "", right.toolId ?? ""),
    metaField("模型", left.model ?? "", right.model ?? ""),
    metaField("工作目录", left.workingDir ?? "", right.workingDir ?? ""),
    metaField("代码会话", left.codeSessionId ?? "", right.codeSessionId ?? ""),
  ];
}

// ── Relative time ──────────────────────────────────────────────────

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 0) return "刚刚";
  if (diffSec < MINUTE) return "刚刚";
  if (diffSec < HOUR) {
    const m = Math.floor(diffSec / MINUTE);
    return `${m} 分钟前`;
  }
  if (diffSec < DAY) {
    const h = Math.floor(diffSec / HOUR);
    return `${h} 小时前`;
  }
  if (diffSec < 2 * DAY) return "昨天";
  if (diffSec < 7 * DAY) {
    const d = Math.floor(diffSec / DAY);
    return `${d} 天前`;
  }
  const d = new Date(then);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Helpers ────────────────────────────────────────────────────────

export function formatJsonDiffValue(val: unknown): string {
  if (val === undefined || val === null) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function snapshotSummary(snapshot: ExperimentSnapshot): string {
  const parts: string[] = [];
  const cfgKeys = Object.keys(snapshot.configSnapshot ?? {});
  if (cfgKeys.length > 0) {
    parts.push(`${cfgKeys.length} 个配置项`);
  }
  if (snapshot.resultSnapshot) {
    const lines = snapshot.resultSnapshot.trim().split("\n").filter(Boolean);
    parts.push(`结果 ${lines.length} 行`);
  }
  if (snapshot.notesSnapshot) {
    parts.push("含备注");
  }
  if (snapshot.codeSessionId) {
    parts.push("关联代码会话");
  }
  return parts.length > 0 ? parts.join(" · ") : "无摘要";
}

// ── Export ─────────────────────────────────────────────────────────

export function exportSnapshotAsJson(snapshot: ExperimentSnapshot): string {
  return JSON.stringify(
    {
      id: snapshot.id,
      experimentId: snapshot.experimentId,
      title: snapshot.title,
      createdAt: snapshot.createdAt,
      config: snapshot.configSnapshot,
      result: snapshot.resultSnapshot,
      notes: snapshot.notesSnapshot,
      env: snapshot.envSnapshot,
      codeSessionId: snapshot.codeSessionId,
      toolId: snapshot.toolId,
      model: snapshot.model,
      workingDir: snapshot.workingDir,
    },
    null,
    2,
  );
}
