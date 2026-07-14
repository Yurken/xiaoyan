import { useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Code2,
  Download,
  GitBranch,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { ExperimentSnapshot } from "@research-copilot/types";
import { Card } from "@research-copilot/ui";
import { formatSnapshotTime, relativeTime, snapshotSummary } from "./shared";

interface ExperimentSnapshotCardProps {
  snapshot: ExperimentSnapshot;
  isSelected: boolean;
  isCompareTarget: boolean;
  isExpanded: boolean;
  selectMode: boolean;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onCompare: (id: string) => void;
  onExport: (snapshot: ExperimentSnapshot) => void;
  onDelete: (id: string) => void;
  onRename: (snapshot: ExperimentSnapshot) => void;
  onRestore: (id: string) => void;
}

type DetailSection = "config" | "result" | "notes" | "env";

const DETAIL_TABS: { key: DetailSection; label: string }[] = [
  { key: "config", label: "配置" },
  { key: "result", label: "结果" },
  { key: "notes", label: "备注" },
  { key: "env", label: "代码状态" },
];

export function ExperimentSnapshotCard({
  snapshot,
  isSelected,
  isCompareTarget,
  isExpanded,
  selectMode,
  onToggleSelect,
  onToggleExpand,
  onCompare,
  onExport,
  onDelete,
  onRename,
  onRestore,
}: ExperimentSnapshotCardProps) {
  const [detailTab, setDetailTab] = useState<DetailSection>("config");
  const rel = relativeTime(snapshot.createdAt);
  const cfgKeys = Object.keys(snapshot.configSnapshot ?? {});
  const hasEnv = Object.keys(snapshot.envSnapshot ?? {}).length > 0 || Boolean(snapshot.workingDir);

  return (
    <Card
      variant="inset"
      padding="sm"
      style={isCompareTarget ? { boxShadow: "0 0 0 1.5px var(--rc-accent)", transition: "box-shadow 0.15s" } : { transition: "box-shadow 0.15s" }}
    >
      {/* ── Top row ─────────────────────────────────────────── */}
      <div className="flex items-start gap-2">
        {selectMode && (
          <button
            type="button"
            aria-label={`选择快照：${snapshot.title}`}
            onClick={() => onToggleSelect(snapshot.id)}
            className="mt-1 flex-shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors"
            style={{
              borderColor: isSelected ? "var(--rc-accent)" : "var(--rc-border)",
              background: isSelected ? "var(--rc-accent)" : "transparent",
            }}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleExpand(snapshot.id)}
          className="flex-1 text-left min-w-0"
        >
          {/* Title + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink-primary truncate">
              {snapshot.title}
            </span>
            {snapshot.codeSessionId && (
              <span
                className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-semibold"
                style={{ background: "var(--rc-accent-alpha, rgba(0,122,255,0.10))", color: "var(--rc-accent, #007AFF)" }}
              >
                <Code2 className="w-2.5 h-2.5" />
                代码
              </span>
            )}
          </div>

          {/* Time + summary */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-ink-tertiary flex-shrink-0" title={formatSnapshotTime(snapshot.createdAt)}>
              {rel}
            </span>
            {cfgKeys.length > 0 && (
              <>
                <span className="text-[10px] text-ink-tertiary/40 flex-shrink-0">·</span>
                <span className="text-[11px] text-ink-tertiary truncate">{snapshotSummary(snapshot)}</span>
              </>
            )}
          </div>
        </button>

        {/* Action buttons */}
        {!selectMode && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRename(snapshot); }}
              className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary hover:bg-nm-dark/10 transition-colors"
              title="重命名快照"
              aria-label={`重命名快照：${snapshot.title}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRestore(snapshot.id); }}
              className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary hover:bg-nm-dark/10 transition-colors"
              title="恢复实验记录"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExport(snapshot); }}
              className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary hover:bg-nm-dark/10 transition-colors"
              title="导出 JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCompare(snapshot.id); }}
              className="p-1.5 rounded-xl transition-colors"
              style={
                isCompareTarget
                  ? { color: "var(--rc-accent)", background: "var(--rc-accent-alpha, rgba(0,122,255,0.10))" }
                  : {}
              }
              title={isCompareTarget ? "已选为对比基准" : "选择对比"}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-ink-tertiary" style={isCompareTarget ? { color: "var(--rc-accent)" } : undefined} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(snapshot.id); }}
              className="p-1.5 rounded-xl text-ink-tertiary hover:text-[var(--rc-apple-red,#FF3B30)] hover:bg-[var(--rc-apple-red-alpha,rgba(255,59,48,0.06))] transition-colors"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Expand toggle ───────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onToggleExpand(snapshot.id)}
        className="flex items-center gap-1 mt-1 text-[11px] text-ink-tertiary hover:text-ink-secondary transition-colors"
      >
        <ChevronDown
          className="w-3 h-3 transition-transform duration-150"
          style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        {isExpanded ? "收起详情" : "展开详情"}
      </button>

      {/* ── Expanded detail ──────────────────────────────────── */}
      {isExpanded && (
        <div className="mt-2 space-y-3">
          {/* Meta info strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {snapshot.codeSessionId && (
              <span className="text-ink-tertiary">
                <span className="text-ink-secondary">会话</span>{" "}
                <span className="font-mono text-[10px]">{snapshot.codeSessionId.slice(0, 8)}…</span>
              </span>
            )}
            {(snapshot.toolId || snapshot.model) && (
              <span className="text-ink-tertiary">
                <span className="text-ink-secondary">模型</span>{" "}
                {[snapshot.toolId, snapshot.model].filter(Boolean).join(" / ") || "—"}
              </span>
            )}
            {snapshot.workingDir && (
              <span className="text-ink-tertiary">
                <span className="text-ink-secondary">目录</span>{" "}
                <span className="font-mono text-[10px]">{snapshot.workingDir}</span>
              </span>
            )}
          </div>

          {/* Detail mini-tabs */}
          <div className="flex gap-1 border-b pb-2" style={{ borderColor: "var(--rc-border)" }}>
            {DETAIL_TABS.map((tab) => {
              const active = detailTab === tab.key;
              const hasContent = tab.key === "config"
                ? cfgKeys.length > 0
                : tab.key === "env"
                  ? hasEnv
                  : !!((snapshot as unknown) as Record<string, unknown>)[`${tab.key}Snapshot` as keyof typeof snapshot];
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key)}
                  disabled={!hasContent}
                  className="relative px-3 py-1 rounded-xl text-[11px] font-medium transition-all duration-150"
                  style={
                    active
                      ? { background: "var(--rc-button-secondary-bg)", boxShadow: "var(--rc-button-secondary-shadow)", color: "var(--rc-text)" }
                      : hasContent
                        ? { color: "var(--rc-text-muted)" }
                        : { color: "var(--rc-text-muted)", opacity: 0.35, cursor: "default" }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Detail content */}
          <div>
            {detailTab === "config" && (
              <pre
                className="p-3 rounded-2xl overflow-auto text-[11px] font-mono leading-relaxed"
                style={{ maxHeight: 200, background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
              >
                {cfgKeys.length > 0 ? JSON.stringify(snapshot.configSnapshot, null, 2) : "无配置"}
              </pre>
            )}
            {detailTab === "result" && (
              <pre
                className="p-3 rounded-2xl whitespace-pre-wrap text-[11px] leading-relaxed"
                style={{ maxHeight: 200, overflow: "auto", background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
              >
                {snapshot.resultSnapshot || "无结果记录"}
              </pre>
            )}
            {detailTab === "notes" && (
              <pre
                className="p-3 rounded-2xl whitespace-pre-wrap text-[11px] leading-relaxed"
                style={{ maxHeight: 200, overflow: "auto", background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
              >
                {snapshot.notesSnapshot || "无备注"}
              </pre>
            )}
            {detailTab === "env" && (
              <CodeStateDetails snapshot={snapshot} />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function CodeStateDetails({ snapshot }: { snapshot: ExperimentSnapshot }) {
  const state = snapshot.envSnapshot ?? {};
  const git = state.git && typeof state.git === "object"
    ? state.git as Record<string, unknown>
    : null;
  const warning = typeof state.captureWarning === "string" ? state.captureWarning : "";
  const directory = typeof state.workingDirectory === "string" ? state.workingDirectory : snapshot.workingDir;

  if (!git && !warning && Object.keys(state).length > 0) {
    return (
      <pre className="p-3 rounded-2xl overflow-auto text-[11px] font-mono leading-relaxed" style={{ maxHeight: 240, background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}>
        {JSON.stringify(state, null, 2)}
      </pre>
    );
  }

  if (!git && !warning) {
    return <p className="text-xs text-ink-tertiary">此快照未记录代码状态。</p>;
  }

  const files = Array.isArray(git?.files) ? git.files : [];
  const stagedDiff = typeof git?.stagedDiff === "string" ? git.stagedDiff : "";
  const unstagedDiff = typeof git?.unstagedDiff === "string" ? git.unstagedDiff : "";
  const branch = typeof git?.branch === "string" ? git.branch : "";
  const head = typeof git?.head === "string" ? git.head : "";
  const isRepo = git?.isRepo === true;

  return (
    <div className="space-y-2 text-[11px]">
      {directory && <p className="font-mono text-ink-tertiary break-all">{directory}</p>}
      {warning ? (
        <p className="rounded-xl px-3 py-2 text-ink-secondary" style={{ background: "var(--rc-card-inset-bg)" }}>
          代码状态采集失败：{warning}
        </p>
      ) : !isRepo ? (
        <p className="text-ink-tertiary">所选目录不是 Git 仓库。</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-ink-secondary">
            <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{branch || "未知分支"}</span>
            {head && <span className="font-mono">@ {head}</span>}
            <span>{files.length} 个变更文件</span>
          </div>
          <CodeDiffDetails label="已暂存 diff" content={stagedDiff} />
          <CodeDiffDetails label="未暂存 diff" content={unstagedDiff} />
        </>
      )}
    </div>
  );
}

function CodeDiffDetails({ label, content }: { label: string; content: string }) {
  if (!content) return null;
  return (
    <details className="rounded-xl px-3 py-2" style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}>
      <summary className="cursor-pointer select-none font-medium text-ink-secondary">
        {label} · {content.split("\n").length} 行
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-ink-secondary">
        {content}
      </pre>
    </details>
  );
}
