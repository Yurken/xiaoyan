import { ArrowLeftRight, Download, X } from "lucide-react";
import type { ExperimentSnapshot } from "@research-copilot/types";
import {
  DIMENSION_LABELS,
  formatJsonDiffValue,
  type CompareDimension,
  type JsonDiffEntry,
  type MetaDiffEntry,
  type SnapshotDiffResult,
  type TextDiffLine,
} from "./shared";

interface ExperimentSnapshotCompareProps {
  leftSnapshot: ExperimentSnapshot;
  rightSnapshot: ExperimentSnapshot;
  diffResult: SnapshotDiffResult;
  activeDimension: CompareDimension;
  onDimensionChange: (dim: CompareDimension) => void;
  onClose: () => void;
  onExportLeft: () => void;
  onExportRight: () => void;
}

const DIMENSIONS: CompareDimension[] = ["config", "result", "notes", "env", "meta"];

export function ExperimentSnapshotCompare({
  leftSnapshot,
  rightSnapshot,
  diffResult,
  activeDimension,
  onDimensionChange,
  onClose,
  onExportLeft,
  onExportRight,
}: ExperimentSnapshotCompareProps) {
  const stats = buildStats(diffResult);

  const leftTime = new Date(leftSnapshot.createdAt).getTime();
  const rightTime = new Date(rightSnapshot.createdAt).getTime();
  const timeHint = leftTime < rightTime ? "较早" : leftTime > rightTime ? "较晚" : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-5 py-3 border-b border-nm-dark/10">
        <div className="flex items-center gap-3 min-w-0">
          <ArrowLeftRight className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
          <span className="text-sm font-semibold text-ink-primary truncate">快照对比</span>
          {stats.changes > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] flex-shrink-0">
              <span className="inline-flex items-center gap-0.5" style={{ color: "var(--rc-apple-green, #34C759)" }}>
                +{stats.added}
              </span>
              <span className="text-ink-tertiary/40">·</span>
              <span className="inline-flex items-center gap-0.5" style={{ color: "var(--rc-apple-red, #FF3B30)" }}>
                −{stats.removed}
              </span>
              <span className="text-ink-tertiary/40">·</span>
              <span className="inline-flex items-center gap-0.5" style={{ color: "#d97706" }}>
                ~{stats.changed}
              </span>
            </div>
          )}
          {stats.changes === 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
              style={{ background: "rgba(52,199,89,0.10)", color: "var(--rc-apple-green, #34C759)" }}
            >
              <span style={{ fontSize: "10px", lineHeight: 1 }}>✓</span>无差异
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Snapshot labels */}
      <div className="flex items-stretch flex-shrink-0 border-b border-nm-dark/10">
        <div className="flex-1 px-4 py-2.5 border-r border-nm-dark/10 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-ink-primary truncate">{leftSnapshot.title}</p>
            {timeHint === "较早" && (
              <span className="flex-shrink-0 inline-block px-1.5 py-px rounded-full text-[9px] font-semibold"
                style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-text-muted)" }}
              >较早</span>
            )}
          </div>
          <p className="text-[10px] text-ink-tertiary mt-0.5">
            {new Date(leftSnapshot.createdAt).toLocaleString("zh-CN")}
          </p>
          <button
            type="button"
            onClick={onExportLeft}
            className="inline-flex items-center gap-1 mt-1 text-[10px] text-ink-tertiary hover:text-ink-primary transition-colors"
          >
            <Download className="w-3 h-3" />
            导出
          </button>
        </div>
        <div className="flex-1 px-4 py-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-ink-primary truncate">{rightSnapshot.title}</p>
            {timeHint === "较晚" && (
              <span className="flex-shrink-0 inline-block px-1.5 py-px rounded-full text-[9px] font-semibold"
                style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-text-muted)" }}
              >较晚</span>
            )}
          </div>
          <p className="text-[10px] text-ink-tertiary mt-0.5">
            {new Date(rightSnapshot.createdAt).toLocaleString("zh-CN")}
          </p>
          <button
            type="button"
            onClick={onExportRight}
            className="inline-flex items-center gap-1 mt-1 text-[10px] text-ink-tertiary hover:text-ink-primary transition-colors"
          >
            <Download className="w-3 h-3" />
            导出
          </button>
        </div>
      </div>

      {/* Dimension tabs — sticky */}
      <div className="flex gap-1 flex-shrink-0 px-4 py-2 overflow-x-auto border-b sticky top-0 z-10"
        style={{
          background: "var(--rc-surface)",
          borderColor: "var(--rc-border, rgb(229,231,235))",
        }}
      >
          {DIMENSIONS.map((dim) => {
            const active = activeDimension === dim;
            const count = dimCount(diffResult, dim);
            return (
              <button
                key={dim}
                type="button"
                onClick={() => onDimensionChange(dim)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                style={
                  active
                    ? { background: "var(--rc-button-secondary-bg)", boxShadow: "var(--rc-button-secondary-shadow)", color: "var(--rc-text)" }
                    : { color: "var(--rc-text-muted)" }
                }
              >
                {DIMENSION_LABELS[dim]}
                {count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold"
                    style={{ background: "var(--rc-accent-alpha, rgba(0,122,255,0.12))", color: "var(--rc-accent, #007AFF)" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeDimension === "config" && <JsonDiffView entries={diffResult.config} />}
        {activeDimension === "result" && <TextDiffView lines={diffResult.result} />}
        {activeDimension === "notes" && <TextDiffView lines={diffResult.notes} />}
        {activeDimension === "env" && <JsonDiffView entries={diffResult.env} />}
        {activeDimension === "meta" && <MetaDiffView entries={diffResult.meta} />}
      </div>
    </div>
  );
}

// ── Sub-views ──────────────────────────────────────────────────────

function JsonDiffView({ entries }: { entries: JsonDiffEntry[] }) {
  if (entries.length === 0) return <EmptyDiff />;

  return (
    <div className="space-y-0.5">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
          style={entryBg(entry.kind)}
        >
          <span className="font-mono text-[11px] font-bold flex-shrink-0 w-4 text-center" style={{ color: entryColor(entry.kind) }}>
            {entryKindIcon(entry.kind)}
          </span>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[11px] font-semibold text-ink-primary">{entry.key}</span>
            <div className="mt-1">
              {entry.kind === "changed" && (
                <div className="flex flex-col gap-0.5">
                  <span className="block max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] line-through" style={{ color: "var(--rc-apple-red, #FF3B30)" }}>
                    − {formatJsonDiffValue(entry.oldValue)}
                  </span>
                  <span className="block max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px]" style={{ color: "var(--rc-apple-green, #34C759)" }}>
                    + {formatJsonDiffValue(entry.newValue)}
                  </span>
                </div>
              )}
              {entry.kind === "added" && (
                <span className="block max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px]" style={{ color: "var(--rc-apple-green, #34C759)" }}>
                  {formatJsonDiffValue(entry.newValue)}
                </span>
              )}
              {entry.kind === "removed" && (
                <span className="block max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] line-through" style={{ color: "var(--rc-apple-red, #FF3B30)" }}>
                  {formatJsonDiffValue(entry.oldValue)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TextDiffView({ lines }: { lines: TextDiffLine[] }) {
  if (lines.length === 0) return <EmptyDiff />;

  const hasChanges = lines.some((l) => l.type !== "same");
  if (!hasChanges) {
    return (
      <div className="font-mono text-xs">
        {lines.map((line, index) => (
          <div key={index} className="flex gap-3 px-2 py-0.5">
            <span className="flex-shrink-0 w-8 text-right text-[10px] text-ink-tertiary/50 select-none">{index + 1}</span>
            <pre className="flex-1 min-w-0 text-ink-secondary" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {line.text || " "}
            </pre>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="font-mono text-xs">
      {lines.map((line, index) => {
        if (line.type === "same") return null;
        return (
          <div
            key={index}
            className="flex gap-3 px-2 py-0.5 rounded"
            style={lineBg(line.type)}
          >
            <span className="flex-shrink-0 w-8 text-right text-[10px] text-ink-tertiary/50 select-none">{index + 1}</span>
            <span className="flex-shrink-0 w-4 text-center font-bold select-none" style={{ color: line.type === "add" ? "var(--rc-apple-green, #34C759)" : "var(--rc-apple-red, #FF3B30)" }}>
              {line.type === "add" ? "+" : "−"}
            </span>
            <pre
              className="flex-1 min-w-0"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", color: line.type === "add" ? "var(--rc-apple-green, #34C759)" : "var(--rc-apple-red, #FF3B30)" }}
            >
              {line.text || " "}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function MetaDiffView({ entries }: { entries: MetaDiffEntry[] }) {
  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.field}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs"
          style={entry.changed ? { background: "var(--rc-card-inset-bg)" } : undefined}
        >
          <span className="w-20 flex-shrink-0 font-medium text-ink-secondary">{entry.label}</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span
              className="flex-1 min-w-0 truncate"
              style={{ color: entry.changed ? "var(--rc-apple-red, #FF3B30)" : "var(--rc-text-muted)", textDecoration: entry.changed ? "line-through" : undefined }}
            >
              {entry.left}
            </span>
            {entry.changed && (
              <>
                <span className="text-ink-tertiary flex-shrink-0">→</span>
                <span className="flex-1 min-w-0 truncate font-medium" style={{ color: "var(--rc-apple-green, #34C759)" }}>{entry.right}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyDiff() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}>
        <span style={{ color: "var(--rc-apple-green, #34C759)", fontSize: "16px", lineHeight: 1 }}>✓</span>
      </div>
      <p className="text-sm text-ink-tertiary">该维度完全一致，无差异</p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function buildStats(diff: SnapshotDiffResult) {
  const configAdd = diff.config.filter((e) => e.kind === "added").length;
  const configRem = diff.config.filter((e) => e.kind === "removed").length;
  const configChg = diff.config.filter((e) => e.kind === "changed").length;
  const resultAdd = diff.result.filter((l) => l.type === "add").length;
  const resultRem = diff.result.filter((l) => l.type === "remove").length;
  const notesAdd = diff.notes.filter((l) => l.type === "add").length;
  const notesRem = diff.notes.filter((l) => l.type === "remove").length;
  const envAdd = diff.env.filter((e) => e.kind === "added").length;
  const envRem = diff.env.filter((e) => e.kind === "removed").length;
  const envChg = diff.env.filter((e) => e.kind === "changed").length;
  const metaChg = diff.meta.filter((e) => e.changed).length;

  return {
    added: configAdd + resultAdd + notesAdd + envAdd,
    removed: configRem + resultRem + notesRem + envRem,
    changed: configChg + envChg + metaChg,
    changes: configAdd + configRem + configChg + resultAdd + resultRem + notesAdd + notesRem + envAdd + envRem + envChg + metaChg,
  };
}

function dimCount(diff: SnapshotDiffResult, dim: CompareDimension): number {
  switch (dim) {
    case "config": return diff.config.length;
    case "result": return diff.result.filter((l) => l.type !== "same").length;
    case "notes": return diff.notes.filter((l) => l.type !== "same").length;
    case "env": return diff.env.length;
    case "meta": return diff.meta.filter((e) => e.changed).length;
  }
}

function entryKindIcon(kind: JsonDiffEntry["kind"]) {
  switch (kind) {
    case "added": return "+";
    case "removed": return "−";
    case "changed": return "~";
  }
}

function entryColor(kind: JsonDiffEntry["kind"] | "added" | "removed") {
  switch (kind) {
    case "added": return "var(--rc-apple-green, #34C759)";
    case "removed": return "var(--rc-apple-red, #FF3B30)";
    case "changed": return "#d97706";
  }
}

function entryBg(kind: JsonDiffEntry["kind"]): Record<string, string> | undefined {
  switch (kind) {
    case "added": return { background: "var(--rc-card-inset-bg)", boxShadow: "inset 0 0 0 1px rgba(52,199,89,0.15)" };
    case "removed": return { background: "var(--rc-card-inset-bg)", boxShadow: "inset 0 0 0 1px rgba(255,59,48,0.12)" };
    case "changed": return { background: "var(--rc-card-inset-bg)", boxShadow: "inset 0 0 0 1px rgba(255,149,0,0.12)" };
  }
}

function lineBg(type: TextDiffLine["type"]): Record<string, string> | undefined {
  switch (type) {
    case "add": return { background: "var(--rc-card-inset-bg)", boxShadow: "inset 0 0 0 1px rgba(52,199,89,0.12)" };
    case "remove": return { background: "var(--rc-card-inset-bg)", boxShadow: "inset 0 0 0 1px rgba(255,59,48,0.10)" };
    default: return undefined;
  }
}
