import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Sparkles, X } from "lucide-react";
import type { Paper } from "@research-copilot/types";
import { paperCorpusApi, paperNotesApi, papersApi } from "../../lib/client";

interface CandidateMeta {
  loading: boolean;
  hasAnalysis: boolean;
  analysisPreview?: string;
  noteCount: number;
  corpusCount: number;
}

interface MergeDuplicatesDialogProps {
  groups: Paper[][];
  busy: boolean;
  onMerge: (keepId: string, deleteIds: string[]) => Promise<void>;
  onClose: () => void;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const groupKey = (group: Paper[]) => group.map((p) => p.id).sort().join("|");

export default function MergeDuplicatesDialog({ groups, busy, onMerge, onClose }: MergeDuplicatesDialogProps) {
  const [meta, setMeta] = useState<Record<string, CandidateMeta>>({});
  // 每组保留哪一篇（key 用组内 id 排序串，避免组顺序变化错位）
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string>>({});

  // 默认保留：优先已解读的，否则最早入库的（组已按入库升序）。
  useEffect(() => {
    setKeepByGroup((prev) => {
      const next = { ...prev };
      for (const group of groups) {
        const gk = groupKey(group);
        if (next[gk] && group.some((p) => p.id === next[gk])) continue;
        const withAnalysis = group.find((p) => meta[p.id]?.hasAnalysis);
        next[gk] = (withAnalysis ?? group[0]).id;
      }
      return next;
    });
  }, [groups, meta]);

  // 拉取判断依据：解读预览 + 批注/语料数量。
  useEffect(() => {
    const ids = [...new Set(groups.flat().map((p) => p.id))].filter((id) => meta[id] === undefined);
    if (ids.length === 0) return;
    let cancelled = false;
    setMeta((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { loading: true, hasAnalysis: false, noteCount: 0, corpusCount: 0 };
      return next;
    });
    (async () => {
      for (const id of ids) {
        try {
          const [detail, notes, corpus] = await Promise.all([
            papersApi.get(id),
            paperNotesApi.list(id).catch(() => []),
            paperCorpusApi.list(id).catch(() => []),
          ]);
          if (cancelled) return;
          const a = detail.analysis;
          const preview = a
            ? (a.key_conclusions || a.research_question || a.core_method || a.innovations || "").trim()
            : "";
          setMeta((prev) => ({
            ...prev,
            [id]: {
              loading: false,
              hasAnalysis: Boolean(a),
              analysisPreview: preview || undefined,
              noteCount: notes.length,
              corpusCount: corpus.length,
            },
          }));
        } catch {
          if (cancelled) return;
          setMeta((prev) => ({ ...prev, [id]: { loading: false, hasAnalysis: false, noteCount: 0, corpusCount: 0 } }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groups, meta]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
        style={{ background: "var(--rc-card-bg)", boxShadow: "var(--rc-raised-shadow)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-5 py-3.5" style={{ borderColor: "var(--rc-border)" }}>
          <h2 className="text-base font-bold text-ink-primary">合并重复论文</h2>
          {groups.length > 0 ? (
            <span className="text-xs text-ink-tertiary">发现 {groups.length} 组疑似重复</span>
          ) : null}
          <button type="button" onClick={onClose} className="rc-icon-button ml-auto h-8 w-8" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-tertiary">没有重复论文了 🎉</div>
          ) : (
            groups.map((group) => {
              const gk = groupKey(group);
              const keepId = keepByGroup[gk] ?? group[0].id;
              const deleteIds = group.filter((p) => p.id !== keepId).map((p) => p.id);
              return (
                <section
                  key={gk}
                  className="rounded-2xl border p-3"
                  style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
                >
                  <p className="mb-2 line-clamp-1 text-xs font-semibold text-ink-secondary">{group[0].title}</p>
                  <div className="space-y-2">
                    {group.map((paper) => {
                      const m = meta[paper.id];
                      const selected = keepId === paper.id;
                      return (
                        <button
                          key={paper.id}
                          type="button"
                          onClick={() => setKeepByGroup((prev) => ({ ...prev, [gk]: paper.id }))}
                          className="flex w-full gap-2.5 rounded-xl border p-2.5 text-left transition-all"
                          style={
                            selected
                              ? {
                                  borderColor: "var(--rc-accent)",
                                  background: "color-mix(in srgb, var(--rc-accent) 10%, transparent)",
                                }
                              : { borderColor: "var(--rc-border)", background: "var(--rc-card-bg)" }
                          }
                        >
                          <span
                            className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border"
                            style={{
                              borderColor: selected ? "var(--rc-accent)" : "var(--rc-border)",
                              background: selected ? "var(--rc-accent)" : "transparent",
                            }}
                          >
                            {selected ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-xs font-semibold"
                                style={{ color: selected ? "var(--rc-accent)" : "var(--rc-text-secondary)" }}
                              >
                                {selected ? "保留为主论文" : "将被合并删除"}
                              </span>
                              {paper.year ? <span className="text-[11px] text-ink-tertiary">· {paper.year}</span> : null}
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-tertiary">
                              {paper.authors || "未知作者"}
                              {paper.venue ? ` · ${paper.venue}` : ""}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-tertiary">
                              <span>入库 {formatDate(paper.created_at)}</span>
                              {paper.doi ? <span className="line-clamp-1">DOI {paper.doi}</span> : null}
                              {m?.loading ? (
                                <span className="inline-flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  读取中
                                </span>
                              ) : (
                                <>
                                  <span>批注 {m?.noteCount ?? 0}</span>
                                  <span>语料 {m?.corpusCount ?? 0}</span>
                                  <span className="inline-flex items-center gap-1">
                                    {m?.hasAnalysis ? (
                                      <>
                                        <Sparkles className="h-3 w-3 text-violet-500" />
                                        已解读
                                      </>
                                    ) : (
                                      "未解读"
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            {m?.hasAnalysis && m.analysisPreview ? (
                              <p
                                className="mt-1 line-clamp-2 rounded-md px-2 py-1 text-[11px] leading-4 text-ink-secondary"
                                style={{ background: "color-mix(in srgb, var(--rc-accent) 6%, transparent)" }}
                              >
                                {m.analysisPreview}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      删除 {deleteIds.length} 篇副本（含 PDF 与批注），语料与解读并入主论文
                    </span>
                    <button
                      type="button"
                      disabled={busy || deleteIds.length === 0}
                      onClick={() => void onMerge(keepId, deleteIds)}
                      className="flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--rc-accent)" }}
                    >
                      合并此组
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
