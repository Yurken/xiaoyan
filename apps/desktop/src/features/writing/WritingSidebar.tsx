import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  ListTree,
  StickyNote,
} from "lucide-react";
import { Textarea } from "@research-copilot/ui";
import WritingSidebarSection from "./WritingSidebarSection";
import type {
  LatexDiagnostic,
  LatexOutlineEntry,
  LatexStats,
} from "./shared";

interface WritingSidebarProps {
  outline: LatexOutlineEntry[];
  diagnostics: LatexDiagnostic[];
  stats: LatexStats;
  notes: string;
  onJumpToLine: (line: number) => void;
  onNotesChange: (value: string) => void;
}

const severityStyle: Record<
  LatexDiagnostic["severity"],
  { icon: typeof AlertCircle; text: string; bg: string }
> = {
  error: { icon: AlertCircle, text: "#FF3B30", bg: "rgba(255,59,48,0.10)" },
  warning: { icon: AlertCircle, text: "#FF9500", bg: "rgba(255,149,0,0.12)" },
  info: { icon: CheckCircle2, text: "#34A853", bg: "rgba(52,199,89,0.12)" },
};

export default function WritingSidebar({
  outline,
  diagnostics,
  stats,
  notes,
  onJumpToLine,
  onNotesChange,
}: WritingSidebarProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <WritingSidebarSection
        title="论文大纲"
        icon={<ListTree className="h-4 w-4" />}
        badge={
          <span className="rounded-full bg-apple-blue/10 px-2 py-0.5 text-[10px] font-bold text-apple-blue">
            {outline.length} 章节
          </span>
        }
      >
        <div className="p-1.5">
          {outline.length === 0 ? (
            <div
              className="m-2 flex h-28 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <p className="text-[11px] leading-relaxed text-ink-tertiary">
                在源码中使用 \section 等命令，大纲将自动在此生成。
              </p>
            </div>
          ) : (
            <OutlineTree
              outline={outline}
              collapsedIds={collapsedIds}
              onToggle={(id) => {
                setCollapsedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onJumpToLine={onJumpToLine}
            />
          )}
        </div>
      </WritingSidebarSection>

      <WritingSidebarSection
        title="稿件状态"
        icon={<BarChart3 className="h-4 w-4" />}
      >
        <div className="grid grid-cols-3 gap-2 p-3.5">
          <StatTile label="字数" value={stats.words} />
          <StatTile label="公式" value={stats.equations} />
          <StatTile label="引用" value={stats.citations} />
          <StatTile label="标签" value={stats.labels} />
          <StatTile label="行数" value={stats.lines} />
          <StatTile label="字符" value={stats.characters} />
        </div>
      </WritingSidebarSection>

      <WritingSidebarSection
        title="结构检查"
        icon={<FileText className="h-4 w-4" />}
        badge={
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              diagnostics.length === 0
                ? "bg-[#34C759]/10 text-[#34C759]"
                : "bg-apple-orange/10 text-apple-orange",
            )}
          >
            {diagnostics.length} 提示
          </span>
        }
      >
        <div className="p-3.5">
          {diagnostics.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#34C759]/5 p-3 text-xs text-[#248A3D]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="font-medium">基本结构完整且正确。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {diagnostics.map((item) => {
                const style = severityStyle[item.severity];
                const Icon = style.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.line && onJumpToLine(item.line)}
                    className="flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-all hover:border-apple-blue/30 hover:bg-apple-blue/5"
                    style={{ borderColor: "var(--rc-border)" }}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: style.text }} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink-primary">{item.title}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-ink-tertiary line-clamp-2">
                        {item.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </WritingSidebarSection>

      <WritingSidebarSection
        title="写作便签"
        icon={<StickyNote className="h-4 w-4" />}
      >
        <div className="p-3.5">
          <Textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="记录审稿要求、待补实验、下一轮修改计划..."
            className="min-h-28 text-xs leading-relaxed transition-all focus:ring-2 focus:ring-apple-blue/20"
            style={{ background: "var(--rc-card-inset-bg)" }}
          />
        </div>
      </WritingSidebarSection>
    </aside>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border p-2 shadow-sm"
      style={{ background: "var(--rc-card-inset-bg)", borderColor: "var(--rc-border)" }}
    >
      <p className="text-sm font-black tracking-tight text-ink-primary">{value.toLocaleString()}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-tertiary/60">{label}</p>
    </div>
  );
}

interface OutlineTreeProps {
  outline: LatexOutlineEntry[];
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  onJumpToLine: (line: number) => void;
}

function OutlineTree({ outline, collapsedIds, onToggle, onJumpToLine }: OutlineTreeProps) {
  const hasChildrenSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < outline.length; i += 1) {
      const next = outline[i + 1];
      if (next && next.level > outline[i].level) {
        set.add(outline[i].id);
      }
    }
    return set;
  }, [outline]);

  const visibleEntries: LatexOutlineEntry[] = [];
  let skipLevel = Infinity;

  for (const entry of outline) {
    if (entry.level > skipLevel) continue;
    skipLevel = Infinity;
    visibleEntries.push(entry);
    if (collapsedIds.has(entry.id)) {
      skipLevel = entry.level;
    }
  }

  return (
    <div className="space-y-0.5">
      {visibleEntries.map((entry) => (
        <div
          key={entry.id}
          className="group flex w-full items-center rounded-lg px-2 py-1 text-left transition-all hover:bg-apple-blue/5"
          style={{ paddingLeft: `${8 + entry.level * 12}px` }}
        >
          {hasChildrenSet.has(entry.id) ? (
            <button
              type="button"
              onClick={() => onToggle(entry.id)}
              className="mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-tertiary/60 transition-colors hover:text-ink-secondary"
            >
              {collapsedIds.has(entry.id) ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="mr-1 inline-block h-4 w-4 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => onJumpToLine(entry.line)}
            className={clsx(
              "min-w-0 flex-1 truncate text-left text-xs transition-colors group-hover:text-ink-primary",
              entry.level === 0 ? "font-bold text-ink-secondary" : "font-medium text-ink-tertiary",
            )}
          >
            {entry.title}
          </button>
        </div>
      ))}
    </div>
  );
}
