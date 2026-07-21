import { BookOpen, Columns2, FileText, Highlighter, ListTree, RectangleHorizontal, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReaderPaperList from "./ReaderPaperList";
import {
  HIGHLIGHT_COLORS,
  SHAPE_LABELS,
  isShapeStyle,
  isTextStyle,
  type PaperNote,
} from "./readerTypes";
import type { ReaderOutlineEntry, ReaderSearchResult } from "./readerNavigation";
import type { ReaderProgressState } from "./useReaderProgress";

type SidebarTab = "papers" | "outline" | "pages" | "search" | "notes";

interface ReaderSidebarProps {
  width: number;
  currentPaperId?: string;
  onPaperSelect: (id: string) => void;
  outline: ReaderOutlineEntry[];
  thumbnails: Record<number, string>;
  numPages: number;
  navigationLoading: boolean;
  navigationError: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: ReaderSearchResult[];
  notes: PaperNote[];
  progress: ReaderProgressState;
  onPageSelect: (page: number) => void;
  onNoteDelete: (id: string) => void;
  onDragStart: (event: React.MouseEvent) => void;
}

const tabs: Array<{ key: SidebarTab; label: string; icon: typeof FileText }> = [
  { key: "papers", label: "论文", icon: FileText },
  { key: "outline", label: "目录", icon: ListTree },
  { key: "pages", label: "页面", icon: BookOpen },
  { key: "search", label: "搜索", icon: Search },
  { key: "notes", label: "批注", icon: Highlighter },
];

function noteLabel(note: PaperNote) {
  if (isTextStyle(note.style)) return "文字";
  if (isShapeStyle(note.style)) return SHAPE_LABELS[note.style];
  if (note.style === "underline") return "下划线";
  if (note.style === "strike") return "删除线";
  return "高亮";
}

export default function ReaderSidebar({
  width,
  currentPaperId,
  onPaperSelect,
  outline,
  thumbnails,
  numPages,
  navigationLoading,
  navigationError,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  notes,
  progress,
  onPageSelect,
  onNoteDelete,
  onDragStart,
}: ReaderSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("outline");
  const [thumbnailColumns, setThumbnailColumns] = useState<1 | 2>(2);
  const previousPaperIdRef = useRef(currentPaperId);
  const navigationStartedRef = useRef(navigationLoading || numPages > 0 || Boolean(navigationError));
  const userSelectedTabRef = useRef(false);
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => a.page - b.page || a.created_at.localeCompare(b.created_at)),
    [notes],
  );

  useEffect(() => {
    if (previousPaperIdRef.current === currentPaperId) return;
    previousPaperIdRef.current = currentPaperId;
    navigationStartedRef.current = false;
    userSelectedTabRef.current = false;
    setActiveTab("outline");
  }, [currentPaperId]);

  useEffect(() => {
    if (navigationLoading) navigationStartedRef.current = true;
  }, [navigationLoading]);

  useEffect(() => {
    if (!navigationStartedRef.current || navigationLoading || userSelectedTabRef.current) return;
    if (outline.length > 0) return;
    if (numPages > 0) setActiveTab("pages");
    else if (navigationError) setActiveTab("papers");
  }, [navigationError, navigationLoading, numPages, outline.length]);

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r"
      style={{ width, background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      <div className="grid h-12 shrink-0 grid-cols-5 border-b px-1.5" style={{ borderColor: "var(--rc-border)" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                userSelectedTabRef.current = true;
                setActiveTab(tab.key);
              }}
              className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
              style={{ color: active ? "var(--rc-accent)" : "var(--rc-text-tertiary)" }}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "papers" ? (
          <ReaderPaperList currentId={currentPaperId} onSelect={onPaperSelect} embedded />
        ) : null}

        {activeTab === "outline" ? (
          <div className="h-full overflow-y-auto px-2 py-2">
            <PanelStatus loading={navigationLoading} error={navigationError} empty={outline.length === 0} emptyText="PDF 没有可识别的目录" />
            <ul className="space-y-0.5">
              {outline.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onPageSelect(entry.page)}
                    className="flex w-full items-start gap-2 rounded-md py-1.5 pr-2 text-left text-xs leading-4 hover:bg-[var(--rc-card-inset-bg)]"
                    style={{ paddingLeft: 8 + Math.min(3, entry.depth) * 12 }}
                  >
                    <span className="min-w-0 flex-1 text-ink-secondary">{entry.title}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-ink-tertiary">{entry.page}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {activeTab === "pages" ? (
          <div className="h-full overflow-y-auto px-3 py-3">
            <PanelStatus loading={navigationLoading} error={navigationError} empty={numPages === 0} emptyText="暂无页面" />
            {numPages > 0 ? (
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] tabular-nums text-ink-tertiary">共 {numPages} 页</span>
                <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--rc-chip-inset-bg)" }} aria-label="缩略图排列">
                  {([
                    { columns: 1, label: "单栏", icon: RectangleHorizontal },
                    { columns: 2, label: "双栏", icon: Columns2 },
                  ] as const).map((option) => {
                    const Icon = option.icon;
                    const active = thumbnailColumns === option.columns;
                    return (
                      <button
                        key={option.columns}
                        type="button"
                        onClick={() => setThumbnailColumns(option.columns)}
                        aria-label={option.label}
                        aria-pressed={active}
                        title={`${option.label}缩略图`}
                        className="flex h-6 w-7 items-center justify-center rounded-md transition-colors"
                        style={active
                          ? { background: "var(--rc-chip-bg)", color: "var(--rc-accent)", boxShadow: "var(--rc-chip-shadow)" }
                          : { color: "var(--rc-text-tertiary)" }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className={`grid gap-3 ${thumbnailColumns === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {Array.from({ length: numPages }, (_, index) => index + 1).map((page) => (
                <button key={page} type="button" onClick={() => onPageSelect(page)} className="group text-center">
                  <div
                    className="aspect-[0.72] overflow-hidden rounded border bg-white transition-colors group-hover:border-apple-blue"
                    style={{ borderColor: "var(--rc-border)" }}
                  >
                    {thumbnails[page] ? <img src={thumbnails[page]} alt={`第 ${page} 页缩略图`} className="h-full w-full object-contain" /> : null}
                  </div>
                  <span className="mt-1 block text-[10px] tabular-nums text-ink-tertiary">{page}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "search" ? (
          <div className="flex h-full flex-col">
            <div className="shrink-0 p-2.5">
              <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
                <Search className="h-3.5 w-3.5 text-ink-tertiary" />
                <input
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="搜索全文"
                  className="rc-selectable min-w-0 flex-1 bg-transparent text-xs text-ink-primary outline-none"
                />
                {searchQuery ? <span className="text-[10px] tabular-nums text-ink-tertiary">{searchResults.length}</span> : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {searchQuery && searchResults.length === 0 ? <p className="py-8 text-center text-xs text-ink-tertiary">没有找到匹配内容</p> : null}
              {searchResults.map((result) => (
                <button
                  key={`${result.page}-${result.snippet}`}
                  type="button"
                  onClick={() => onPageSelect(result.page)}
                  className="mb-0 w-full rounded-md px-2 py-2 text-left hover:bg-[var(--rc-card-inset-bg)]"
                >
                  <span className="block text-[10px] font-semibold text-apple-blue">第 {result.page} 页</span>
                  <span className="line-clamp-3 text-[11px] leading-4 text-ink-secondary">
                    <HighlightSnippet snippet={result.snippet} query={searchQuery} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="h-full overflow-y-auto px-2 py-2">
            {sortedNotes.length === 0 ? <p className="py-8 text-center text-xs text-ink-tertiary">还没有批注</p> : null}
            {sortedNotes.map((note) => (
              <div key={note.id} className="group relative mb-1.5 rounded-lg px-2.5 py-2 hover:bg-[var(--rc-card-inset-bg)] focus-within:bg-[var(--rc-card-inset-bg)]">
                <button type="button" onClick={() => onPageSelect(note.page)} className="w-full pr-6 text-left">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: HIGHLIGHT_COLORS[note.highlight_color].border }} />
                    <span className="text-[10px] font-semibold text-ink-secondary">{noteLabel(note)}</span>
                    <span className="ml-auto text-[10px] tabular-nums text-ink-tertiary">第 {note.page} 页</span>
                  </div>
                  <p className="line-clamp-3 text-[11px] leading-4 text-ink-secondary">
                    {note.content?.trim() || note.highlight_text?.trim() || "无文字内容"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onNoteDelete(note.id);
                  }}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-apple-red/10 hover:text-apple-red focus-visible:text-apple-red"
                  aria-label={`删除第 ${note.page} 页${noteLabel(note)}批注`}
                  title="删除批注"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: "var(--rc-border)" }}>
        <div className="mb-1 flex items-center justify-between text-[10px] text-ink-tertiary">
          <span>阅读进度</span>
          <span className="tabular-nums">{progress.totalPages ? `${progress.page}/${progress.totalPages}` : "—"} · {Math.round(progress.percent)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--rc-chip-inset-bg)" }}>
          <div className="h-full rounded-full bg-apple-blue transition-transform" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-apple-blue/30" onMouseDown={onDragStart} />
    </aside>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightSnippet({ snippet, query }: { snippet: string; query: string }) {
  const tokens = query.trim().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return <>{snippet}</>;

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = snippet.split(pattern);
  const normalizedTokens = tokens.map((token) => token.toLocaleLowerCase());

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = normalizedTokens.includes(part.toLocaleLowerCase());
        return isMatch ? (
          <mark key={index} className="rounded-sm bg-yellow-200 px-0.5 text-yellow-900">{part}</mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

function PanelStatus({ loading, error, empty, emptyText }: { loading: boolean; error: string; empty: boolean; emptyText: string }) {
  if (error) return <p className="px-2 py-6 text-center text-xs text-apple-red">{error}</p>;
  if (loading && empty) return <p className="px-2 py-6 text-center text-xs text-ink-tertiary">正在读取 PDF…</p>;
  if (empty) return <p className="px-2 py-6 text-center text-xs text-ink-tertiary">{emptyText}</p>;
  return null;
}
