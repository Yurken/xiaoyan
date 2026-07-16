import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookMarked, Check, Copy, FileText, Languages, Pencil, RefreshCw, Search, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { useCorpus } from "./useCorpus";
import { useCorpusRewrite } from "./useCorpusRewrite";
import { useCorpusTranslation } from "./useCorpusTranslation";
import type { CorpusEntry } from "./corpusTypes";

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

export default function CorpusPanel() {
  const navigate = useNavigate();
  const { entries, loading, error, updateNote, deleteEntry } = useCorpus();
  const { rewrites, rewrite, clearRewrite } = useCorpusRewrite();
  const { translations, translate, clearTranslation } = useCorpusTranslation();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedRewriteId, setCopiedRewriteId] = useState<string | null>(null);
  const [copiedTranslationId, setCopiedTranslationId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return entries;
    return entries.filter(
      (entry) =>
        entry.text.toLowerCase().includes(keyword) ||
        entry.note.toLowerCase().includes(keyword) ||
        (entry.paper_title ?? "").toLowerCase().includes(keyword),
    );
  }, [entries, query]);

  const searchRef = useRef<HTMLDivElement>(null);

  const copy = async (entry: CorpusEntry) => {
    await navigator.clipboard.writeText(entry.text);
    setCopiedId(entry.id);
    window.setTimeout(() => setCopiedId((current) => (current === entry.id ? null : current)), 1200);
  };

  const copyRewrite = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedRewriteId(id);
    window.setTimeout(() => setCopiedRewriteId((current) => (current === id ? null : current)), 1200);
  };

  const copyTranslation = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTranslationId(id);
    window.setTimeout(() => setCopiedTranslationId((current) => (current === id ? null : current)), 1200);
  };

  const startEdit = (entry: CorpusEntry) => {
    setEditingId(entry.id);
    setDraftNote(entry.note);
  };

  const saveEdit = () => {
    if (editingId) void updateNote(editingId, draftNote.trim());
    setEditingId(null);
    setDraftNote("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          ref={searchRef}
          className="relative flex flex-1 items-center overflow-hidden rounded-[24px]"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (searchRef.current) {
                searchRef.current.style.boxShadow =
                  "var(--rc-chip-inset-shadow), 0 0 0 2px rgba(0,122,255,0.25)";
              }
            }}
            onBlur={() => {
              if (searchRef.current) {
                searchRef.current.style.boxShadow = "var(--rc-chip-inset-shadow)";
              }
            }}
            placeholder="搜索语料、备注或论文…"
            className="rc-selectable h-10 w-full border-0 bg-transparent pl-11 pr-4 text-sm text-ink-primary outline-none placeholder:text-ink-tertiary/75"
          />
        </div>
        <span className="text-xs text-ink-tertiary">{entries.length} 条语料</span>
      </div>

      {error ? <p className="rounded-lg bg-apple-red/10 px-3 py-2 text-xs text-apple-red">{error}</p> : null}

      {loading ? (
        <p className="px-1 py-10 text-center text-sm text-ink-tertiary">加载中…</p>
      ) : filtered.length === 0 ? (
        <Card padding="lg" variant="inset" className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <BookMarked className="h-6 w-6 text-apple-blue" />
          <p className="text-sm font-semibold text-ink-primary">{query ? "没有匹配的语料" : "语料库还是空的"}</p>
          <p className="max-w-md text-xs leading-5 text-ink-tertiary">
            在论文批注阅读中划选有价值的句子，点「语料」即可收入这里，便于写作时复用。
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((entry) => (
            <Card key={entry.id} padding="sm" className="group">
              <p className="rc-selectable text-sm leading-6 text-ink-primary">{entry.text}</p>

              {editingId === entry.id ? (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="备注…"
                    className="rc-selectable w-full resize-none rounded-lg border px-2.5 py-1.5 text-xs leading-5 text-ink-primary outline-none"
                    style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
                  />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={saveEdit} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: "var(--rc-accent)" }}>
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:bg-white/5">
                      取消
                    </button>
                  </div>
                </div>
              ) : entry.note ? (
                <p className="mt-1.5 rounded-lg px-2.5 py-1.5 text-xs leading-5 text-ink-secondary" style={{ background: "var(--rc-card-inset-bg)" }}>
                  {entry.note}
                </p>
              ) : null}

              {rewrites[entry.id] ? (
                <div
                  className="mt-2 rounded-lg border p-2.5"
                  style={{ borderColor: "rgba(124,92,255,0.35)", background: "rgba(124,92,255,0.07)" }}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    <span className="text-[11px] font-semibold text-violet-500">小妍改写（可引用）</span>
                    <div className="ml-auto flex items-center gap-1">
                      {rewrites[entry.id].status === "done" ? (
                        <button
                          type="button"
                          onClick={() => void copyRewrite(entry.id, rewrites[entry.id].text)}
                          className="rounded p-0.5 text-ink-tertiary hover:text-apple-blue"
                          title="复制改写"
                        >
                          {copiedRewriteId === entry.id ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                      {rewrites[entry.id].status !== "loading" ? (
                        <button
                          type="button"
                          onClick={() => void rewrite(entry.id, entry.text)}
                          className="rounded p-0.5 text-ink-tertiary hover:text-violet-600"
                          title="重新改写"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => clearRewrite(entry.id)}
                        className="rounded p-0.5 text-ink-tertiary hover:text-ink-secondary"
                        title="关闭"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {rewrites[entry.id].status === "loading" && !rewrites[entry.id].text ? (
                    <p className="text-xs text-ink-tertiary">小妍改写中…</p>
                  ) : rewrites[entry.id].status === "error" ? (
                    <p className="text-xs text-apple-red">{rewrites[entry.id].error}</p>
                  ) : (
                    <p className="rc-selectable whitespace-pre-wrap text-sm leading-6 text-ink-primary">{rewrites[entry.id].text}</p>
                  )}
                </div>
              ) : null}

              {translations[entry.id] ? (
                <div
                  className="mt-2 rounded-lg border p-2.5"
                  style={{ borderColor: "rgba(0,122,255,0.35)", background: "rgba(0,122,255,0.07)" }}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Languages className="h-3 w-3 text-apple-blue" />
                    <span className="text-[11px] font-semibold text-apple-blue">翻译结果</span>
                    <div className="ml-auto flex items-center gap-1">
                      {translations[entry.id].status === "done" ? (
                        <button
                          type="button"
                          onClick={() => void copyTranslation(entry.id, translations[entry.id].text)}
                          className="rounded p-0.5 text-ink-tertiary hover:text-apple-blue"
                          title="复制译文"
                        >
                          {copiedTranslationId === entry.id ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                      {translations[entry.id].status !== "loading" ? (
                        <button
                          type="button"
                          onClick={() => void translate(entry.id, entry.text)}
                          className="rounded p-0.5 text-ink-tertiary hover:text-apple-blue"
                          title="重新翻译"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => clearTranslation(entry.id)}
                        className="rounded p-0.5 text-ink-tertiary hover:text-ink-secondary"
                        title="关闭"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {translations[entry.id].status === "loading" && !translations[entry.id].text ? (
                    <p className="text-xs text-ink-tertiary">翻译中…</p>
                  ) : translations[entry.id].status === "error" ? (
                    <p className="text-xs text-apple-red">{translations[entry.id].error}</p>
                  ) : (
                    <p className="rc-selectable whitespace-pre-wrap text-sm leading-6 text-ink-primary">{translations[entry.id].text}</p>
                  )}
                </div>
              ) : null}

              <div className="mt-2 flex items-center gap-3 border-t pt-2 text-xs text-ink-tertiary" style={{ borderColor: "var(--rc-border)" }}>
                {entry.paper_id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/papers/${entry.paper_id}/reader`)}
                    className="flex min-w-0 items-center gap-1 transition-colors hover:text-apple-blue"
                    title="回到论文批注阅读"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="max-w-[260px] truncate">{entry.paper_title || "未知论文"}</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />未关联论文</span>
                )}
                {entry.page ? <span>第 {entry.page} 页</span> : null}
                <span>{formatDate(entry.created_at)}</span>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void translate(entry.id, entry.text)}
                    disabled={translations[entry.id]?.status === "loading"}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-apple-blue transition-colors hover:text-brand-600 disabled:opacity-50"
                    title="翻译成中文"
                  >
                    <Languages className="h-3.5 w-3.5" />
                    翻译
                  </button>
                  <button
                    type="button"
                    onClick={() => void rewrite(entry.id, entry.text)}
                    disabled={rewrites[entry.id]?.status === "loading"}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-violet-500 transition-colors hover:text-violet-600 disabled:opacity-50"
                    title="让小妍改写为可引用表述"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    改写
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => void copy(entry)} className="rounded p-1 hover:text-apple-blue" title="复制">
                      {copiedId === entry.id ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => startEdit(entry)} className="rounded p-1 hover:text-apple-blue" title="编辑备注">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => void deleteEntry(entry.id)} className="rounded p-1 hover:text-apple-red" title="删除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
