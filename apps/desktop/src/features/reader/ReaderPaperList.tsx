import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import type { Paper } from "@research-copilot/types";
import { papersApi } from "../../lib/client";

interface ReaderPaperListProps {
  currentId?: string;
  onSelect: (id: string) => void;
  width?: number;
  onDragStart?: (event: React.MouseEvent) => void;
}

/** 阅读页左侧的库内论文列表，点击切换到另一篇论文阅读。 */
export default function ReaderPaperList({ currentId, onSelect, width, onDragStart }: ReaderPaperListProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    papersApi
      .list(0, 200)
      .then((rows) => {
        if (!cancelled) setPapers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setPapers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return papers;
    return papers.filter(
      (p) => p.title?.toLowerCase().includes(kw) || p.authors?.toLowerCase().includes(kw),
    );
  }, [papers, keyword]);

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r"
      style={{ width, background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3" style={{ borderColor: "var(--rc-border)" }}>
        <FileText className="h-4 w-4 text-apple-blue" />
        <span className="text-sm font-bold text-ink-primary">论文库</span>
        <span className="ml-auto text-xs text-ink-tertiary">{papers.length}</span>
      </div>

      <div className="shrink-0 px-2.5 py-2">
        <div
          className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
        >
          <Search className="h-3.5 w-3.5 text-ink-tertiary" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题/作者"
            className="rc-selectable w-full bg-transparent text-xs text-ink-primary outline-none placeholder:text-ink-tertiary"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <p className="px-1 py-6 text-center text-xs text-ink-tertiary">加载中…</p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-ink-tertiary">没有匹配的论文</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((paper) => {
              const active = paper.id === currentId;
              return (
                <li key={paper.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(paper.id)}
                    className={`flex min-h-[56px] w-full flex-col justify-center rounded-lg px-2.5 py-2 text-left transition-colors ${
                      active ? "bg-apple-blue/10" : "hover:bg-[var(--rc-card-inset-bg)]"
                    }`}
                  >
                    <p
                      className="line-clamp-2 text-xs font-semibold leading-4"
                      style={{ color: active ? "var(--rc-accent)" : "var(--rc-text-primary)" }}
                    >
                      {paper.title || "未命名论文"}
                    </p>
                    {paper.authors || paper.year ? (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-tertiary">
                        {[paper.authors, paper.year].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {!paper.file_path ? (
                      <p className="mt-0.5 text-[10px] text-apple-red/80">无本地 PDF</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {onDragStart ? (
        <div
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-apple-blue/30"
          onMouseDown={onDragStart}
        />
      ) : null}
    </aside>
  );
}
