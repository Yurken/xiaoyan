import { useEffect, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import { apiClient } from "../../lib/client";
import type { ActiveResearcherFinding } from "../../lib/client";
import ExternalLinkCmp from "../../components/ExternalLink";

interface CompanionFindingsDrawerProps {
  onClose: () => void;
}

export default function CompanionFindingsDrawer({ onClose }: CompanionFindingsDrawerProps) {
  const [findings, setFindings] = useState<ActiveResearcherFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.activeResearcher.findings(12).then((r) => {
      setFindings(r.findings.filter((f) => !f.is_read));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await apiClient.activeResearcher.markRead().catch(() => {});
    onClose();
  };

  return (
    <div
      className="absolute bottom-0 right-0 z-40 w-80 max-h-96 overflow-hidden rounded-3xl flex flex-col"
      style={{
        background: "var(--rc-card-bg)",
        boxShadow: "4px 8px 32px rgba(0,0,0,0.2)",
        border: "1px solid var(--rc-border)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--rc-border)" }}
      >
        <p className="text-sm font-bold text-ink-primary">
          小妍帮你找到了 {findings.length} 篇论文
        </p>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
          <X className="w-4 h-4 text-ink-tertiary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-ink-tertiary" />
          </div>
        ) : findings.length === 0 ? (
          <p className="text-center text-xs text-ink-tertiary py-6">没有新论文啦~</p>
        ) : (
          findings.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl px-3 py-2.5 transition-colors"
              style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ExternalLinkCmp
                    href={f.abs_url}
                    className="text-xs font-semibold text-ink-primary hover:text-apple-blue line-clamp-2 leading-snug"
                  >
                    {f.title}
                  </ExternalLinkCmp>
                  <p className="text-[11px] text-ink-tertiary mt-0.5">{f.authors}</p>
                  {f.relevance_reason ? (
                    <p className="mt-1.5 text-[11px] leading-5 text-ink-secondary" style={{ color: "#FF9500" }}>
                      {f.relevance_reason}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-3">
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: f.relevance_score >= 80 ? "rgba(52,199,89,0.12)" : "rgba(255,149,0,0.1)",
                        color: f.relevance_score >= 80 ? "#34C759" : "#FF9500",
                      }}
                    >
                      {f.relevance_score}% 相关
                    </span>
                    <ExternalLinkCmp
                      href={f.abs_url}
                      className="text-[10px] font-medium text-apple-blue hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      查看
                    </ExternalLinkCmp>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {findings.length > 0 ? (
        <div className="px-4 py-2.5 flex-shrink-0" style={{ borderTop: "1px solid var(--rc-border)" }}>
          <button
            onClick={markAllRead}
            className="w-full py-2 rounded-xl text-xs font-medium text-ink-secondary hover:bg-black/5 transition-colors"
          >
            知道了，都标记已读
          </button>
        </div>
      ) : null}
    </div>
  );
}
