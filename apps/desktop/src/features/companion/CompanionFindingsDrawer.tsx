import { createPortal } from "react-dom";
import { Download, Loader2, Sparkles, X } from "lucide-react";
import ExternalLinkCmp from "../../components/ExternalLink";
import { formatDateTime } from "../tools/shared";
import { useCompanionFindings } from "./useCompanionFindings";

interface CompanionFindingsDrawerProps {
  onClose: () => void;
  onMarkAllRead: () => void;
  onFindingImported?: (findingId: string) => void;
}

export default function CompanionFindingsDrawer({
  onClose,
  onMarkAllRead,
  onFindingImported,
}: CompanionFindingsDrawerProps) {
  const {
    findings,
    loading,
    importingId,
    importErrors,
    notice,
    setNotice,
    markAllRead,
    importFinding,
  } = useCompanionFindings({
    onMarkAllRead,
    onFindingImported,
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "var(--rc-card-bg)",
          boxShadow: "8px 8px 32px rgba(0,0,0,0.25)",
          maxHeight: "88vh",
        }}
      >
        <div
          className="px-6 py-5 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid var(--rc-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,122,255,0.12)" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#007AFF" }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink-primary">
                小妍帮你找到了 {findings.length} 篇论文
              </h2>
              <p className="text-xs text-ink-tertiary mt-0.5">
                基于你的研究主题，从 arXiv 筛选出的可能相关的新论文
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 transition-colors"
            aria-label="关闭论文抽屉"
          >
            <X className="w-5 h-5 text-ink-tertiary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {notice ? (
            <div
              className="rounded-2xl px-4 py-3 text-sm font-medium"
              style={{
                background: "rgba(52,199,89,0.12)",
                color: "#1f7a38",
                border: "1px solid rgba(52,199,89,0.2)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice("")}
                  className="text-xs font-semibold opacity-70 transition-opacity hover:opacity-100"
                >
                  收起
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-ink-tertiary" />
              <p className="text-sm text-ink-tertiary">正在拉取论文…</p>
            </div>
          ) : findings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-ink-tertiary">没有新论文啦~</p>
              <p className="text-xs text-ink-tertiary">小妍会继续帮你盯着 arXiv</p>
            </div>
          ) : (
            findings.map((f) => (
              <div
                key={f.id}
                className="rounded-2xl px-4 py-3 transition-colors"
                style={{
                  background: "var(--rc-card-inset-bg)",
                  border: "1px solid var(--rc-card-inset-outline)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <ExternalLinkCmp
                      href={f.abs_url}
                      className="text-sm font-semibold text-ink-primary hover:text-apple-blue line-clamp-2 leading-snug"
                    >
                      {f.title}
                    </ExternalLinkCmp>
                    <p className="text-xs text-ink-tertiary mt-1">{f.authors}</p>
                    {f.interest_topic ? (
                      <p className="text-[11px] text-ink-tertiary mt-0.5">
                        主题：{f.interest_topic}
                      </p>
                    ) : null}
                    {f.relevance_reason ? (
                      <p
                        className="mt-2 text-xs leading-5 text-ink-secondary"
                        style={{ color: "#FF9500" }}
                      >
                        {f.relevance_reason}
                      </p>
                    ) : null}

                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background:
                            f.relevance_score >= 80
                              ? "rgba(52,199,89,0.12)"
                              : "rgba(255,149,0,0.1)",
                          color: f.relevance_score >= 80 ? "#34C759" : "#FF9500",
                        }}
                      >
                        {f.relevance_score}% 相关
                      </span>
                      {f.published_at ? (
                        <span className="text-[11px] text-ink-tertiary">
                          {formatDateTime(f.published_at)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void importFinding(f)}
                        disabled={importingId === f.id}
                        aria-label={`下载并导入 ${f.title}`}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background: "rgba(0,122,255,0.1)",
                          color: "#007AFF",
                        }}
                      >
                        {importingId === f.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            导入中…
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" />
                            下载并导入
                          </>
                        )}
                      </button>
                    </div>
                    {importErrors[f.id] ? (
                      <p className="mt-2 text-[11px] leading-5 text-apple-red">
                        {importErrors[f.id]}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {findings.length > 0 ? (
          <div
            className="px-6 py-4 flex-shrink-0 flex items-center justify-between gap-3"
            style={{ borderTop: "1px solid var(--rc-border)" }}
          >
            <p className="text-xs text-ink-tertiary">点击论文标题可在 arXiv 查看原文</p>
            <button
              onClick={markAllRead}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-colors hover:opacity-90"
              style={{ background: "#007AFF" }}
            >
              知道了，全部已读
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
