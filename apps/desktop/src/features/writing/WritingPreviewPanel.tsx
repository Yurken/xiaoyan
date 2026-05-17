import { BarChart3, BookOpen, FileText, PenTool, Plus } from "lucide-react";
import { Textarea } from "@research-copilot/ui";
import type { LatexPreviewBlock, LatexSnippet, LatexStats } from "./shared";

interface WritingPreviewPanelProps {
  blocks: LatexPreviewBlock[];
  stats: LatexStats;
  snippets: LatexSnippet[];
  notes: string;
  compact: boolean;
  onNotesChange: (value: string) => void;
  onInsertSnippet: (snippet: LatexSnippet) => void;
}

export default function WritingPreviewPanel({
  blocks,
  stats,
  snippets,
  notes,
  compact,
  onNotesChange,
  onInsertSnippet,
}: WritingPreviewPanelProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <section
        className="rounded-[8px] border p-3"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">稿件状态</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="字词" value={stats.words} />
          <StatTile label="公式" value={stats.equations} />
          <StatTile label="引用" value={stats.citations} />
          <StatTile label="标签" value={stats.labels} />
          <StatTile label="行数" value={stats.lines} />
          <StatTile label="字符" value={stats.characters} />
        </div>
      </section>

      <section
        className="rounded-[8px] border p-3"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <PenTool className="h-4 w-4 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">轻量插入</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {snippets.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              onClick={() => onInsertSnippet(snippet)}
              title={snippet.description}
              className="flex min-h-12 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-nm-dark/8"
              style={{ background: "var(--rc-card-inset-bg)" }}
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-apple-blue" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-ink-primary">{snippet.title}</span>
                <span className="block truncate text-[10px] text-ink-tertiary">{snippet.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="rounded-[8px] border p-3"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">结构预览</p>
        </div>
        <div className={`${compact ? "max-h-[34rem]" : "max-h-none"} space-y-3 overflow-y-auto pr-1`}>
          {blocks.map((block) => (
            <article
              key={block.id}
              className="rounded-xl px-3 py-2.5"
              style={{ background: block.kind === "meta" ? "rgba(0,122,255,0.08)" : "var(--rc-card-inset-bg)" }}
            >
              <p
                className={
                  block.kind === "meta"
                    ? "text-sm font-bold text-ink-primary"
                    : block.level <= 1
                      ? "text-sm font-semibold text-ink-primary"
                      : "text-xs font-semibold text-ink-primary"
                }
              >
                {block.title}
              </p>
              {block.content ? (
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-6 text-ink-secondary">
                  {block.content.length > 900 ? `${block.content.slice(0, 900)}...` : block.content}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-tertiary">这一段还没有正文。</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section
        className="rounded-[8px] border p-3"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-flat-shadow)" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">写作便签</p>
        </div>
        <Textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="记录审稿要求、待补实验、下一轮修改计划..."
          className="min-h-28 text-xs leading-5"
        />
      </section>
    </aside>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl px-2 py-2 text-center" style={{ background: "var(--rc-card-inset-bg)" }}>
      <p className="text-sm font-semibold text-ink-primary">{value}</p>
      <p className="mt-0.5 text-[10px] text-ink-tertiary">{label}</p>
    </div>
  );
}
