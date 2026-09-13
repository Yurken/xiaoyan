import { FileText, Loader2, Plus, Search } from "lucide-react";
import { clsx } from "clsx";
import { Button, Input } from "@research-copilot/ui";
import type { KnowledgeNote } from "@research-copilot/types";

export default function NoteTitleList({
  notes,
  selectedId,
  search,
  loading,
  onSearchChange,
  onSelect,
  onCreate,
}: {
  notes: KnowledgeNote[];
  selectedId: string | null;
  search: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (note: KnowledgeNote) => void;
  onCreate: () => void;
}) {
  return (
    <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-3xl border" style={{
      background: "var(--rc-bg)",
      borderColor: "var(--rc-border)",
      boxShadow: "var(--rc-card-flat-shadow)",
    }}>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">笔记</h2>
            <p className="mt-0.5 text-xs tabular-nums text-ink-tertiary">{notes.length} 篇</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" />
            新建
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <Input
            type="search"
            aria-label="搜索当前范围的笔记"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索笔记"
            className="pl-10"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" role="listbox" aria-label="笔记标题">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-ink-tertiary" /></div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <FileText className="h-5 w-5 text-ink-tertiary" />
            <p className="mt-3 text-sm text-ink-secondary">{search ? "没有匹配的笔记" : "这里还没有笔记"}</p>
            <p className="mt-1 text-xs text-ink-tertiary">{search ? "换个关键词试试。" : "新建一篇，开始记录研究过程。"}</p>
          </div>
        ) : notes.map((note) => {
          const selected = note.id === selectedId;
          return (
            <button
              key={note.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={clsx(
                "mb-1 min-h-11 w-full rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium transition-[color,background,box-shadow]",
                selected ? "text-apple-blue" : "text-ink-secondary hover:bg-[var(--rc-list-item-hover-bg)] hover:text-ink-primary",
              )}
              style={selected ? {
                background: "var(--rc-chip-inset-bg)",
                boxShadow: "var(--rc-chip-inset-shadow)",
              } : undefined}
              onClick={() => onSelect(note)}
            >
              {note.title || "无标题笔记"}
            </button>
          );
        })}
      </div>
    </section>
  );
}
