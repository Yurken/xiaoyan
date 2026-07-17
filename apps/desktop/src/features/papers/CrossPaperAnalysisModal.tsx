import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";
import type { Paper } from "@research-copilot/types";
import { openLink } from "../../lib/links";

interface CrossPaperAnalysisModalProps {
  open: boolean;
  papers: Paper[];
  loading: boolean;
  error: string;
  result: { papers: Array<{ index: number; title: string; authors: string; year: number | null; venue: string }>; analysis: string } | null;
  onClose: () => void;
  onAnalyze: () => void;
  onReset: () => void;
}

export default function CrossPaperAnalysisModal({
  open,
  papers,
  loading,
  error,
  result,
  onClose,
  onAnalyze,
  onReset,
}: CrossPaperAnalysisModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--rc-modal-backdrop)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--rc-modal-bg)", boxShadow: "var(--rc-modal-shadow)", maxHeight: "88vh" }}
      >
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--rc-border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,149,0,0.12)" }}>
              <ArrowRightLeft className="w-4 h-4" style={{ color: "#FF9500" }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink-primary">交叉对比分析</h2>
              <p className="text-xs text-ink-tertiary mt-0.5">
                {result ? `已对比 ${result.papers.length} 篇论文` : `已选择 ${papers.length} 篇论文`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--rc-list-item-hover-bg)] transition-colors">
            <X className="w-5 h-5 text-ink-tertiary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!result ? (
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                {papers.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl px-4 py-3"
                    style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
                  >
                    <p className="text-sm font-semibold text-ink-primary leading-snug">{p.title}</p>
                    <p className="text-xs text-ink-tertiary mt-1">
                      {p.authors || "未知作者"}
                      {p.year ? ` · ${p.year}` : ""}
                      {p.venue ? ` · ${p.venue}` : ""}
                    </p>
                  </div>
                ))}
              </div>

              {error ? (
                <div className="rounded-2xl px-4 py-3 text-sm text-red-600" style={{ background: "rgba(255,59,48,0.08)" }}>
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#FF9500" }} />
                  <p className="text-sm text-ink-secondary">正在分析 {papers.length} 篇论文…</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="p-6">
              <MarkdownRenderer
                content={result.analysis}
                className="text-sm leading-7 text-ink-secondary"
                onLinkClick={openLink}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex-shrink-0 flex items-center justify-between" style={{ borderTop: "1px solid var(--rc-border)" }}>
          {result ? (
            <>
              <button
                onClick={onReset}
                className="text-sm font-medium px-4 py-2 rounded-xl hover:bg-[var(--rc-list-item-hover-bg)] transition-colors"
                style={{ color: "var(--rc-text-secondary)" as string }}
              >
                重新分析
              </button>
              <span className="text-xs text-ink-tertiary">分析结果由 AI 生成，仅供参考</span>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-tertiary">选择 2-8 篇论文进行深度对比</p>
              <button
                disabled={papers.length < 2 || loading}
                onClick={onAnalyze}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: "#FF9500", color: "#fff", boxShadow: "2px 4px 10px rgba(255,149,0,0.3)" }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />分析中…</>
                ) : (
                  <>开始交叉分析</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
