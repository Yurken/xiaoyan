import { useEffect } from "react";
import { Bell, CheckCheck, ExternalLink, Lightbulb, Loader2, Radar, RefreshCw } from "lucide-react";
import { Button, Card, Badge } from "@research-copilot/ui";
import { useActiveResearcher } from "./useActiveResearcher";
import ExternalLinkCmp from "../../components/ExternalLink";

export default function ActiveResearcherSection() {
  const { findings, unreadCount, scannedInterests, scanning, error, loadFindings, scan, markRead } = useActiveResearcher();

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5" style={{ color: "#FF9500" }} />
          <h3 className="text-base font-bold text-ink-primary">主动研究员</h3>
          {unreadCount > 0 ? (
            <Badge variant="warning">{unreadCount} 条新发现</Badge>
          ) : null}
          {scannedInterests > 0 ? (
            <span className="text-xs text-ink-tertiary">已扫描 {scannedInterests} 个研究方向</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => markRead()}>
              <CheckCheck className="h-3.5 w-3.5" />
              全部已读
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={scanning}
            onClick={() => scan(7)}
          >
            {scanning ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />扫描中…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5" />扫描最新论文</>
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : null}

      {findings.length === 0 && !scanning ? (
        <div
          className="flex flex-col items-center gap-3 py-8 text-center rounded-2xl"
          style={{ background: "var(--rc-card-inset-bg)" }}
        >
          <Bell className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="text-sm font-medium text-ink-secondary">暂无最新论文推荐</p>
            <p className="text-xs text-ink-tertiary mt-1">
              点击「扫描最新论文」，AI 将根据你的研究兴趣自动检索并向你推荐 arXiv 新论文
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-[36rem] overflow-y-auto">
          {findings.map((finding) => (
            <div
              key={finding.id}
              className="rounded-2xl px-4 py-3 transition-colors"
              style={{
                background: finding.is_read ? "var(--rc-card-inset-bg)" : "rgba(255,149,0,0.06)",
                border: finding.is_read ? "1px solid var(--rc-card-inset-outline)" : "1px solid rgba(255,149,0,0.15)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={finding.relevance_score >= 80 ? "success" : finding.relevance_score >= 60 ? "warning" : "default"}>
                      {finding.relevance_score}% 相关
                    </Badge>
                    <Badge variant="default">{finding.interest_topic}</Badge>
                    {!finding.is_read ? (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#FF9500" }} />
                    ) : null}
                  </div>
                  <ExternalLinkCmp
                    href={finding.abs_url}
                    className="text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline mt-1.5 line-clamp-2"
                  >
                    {finding.title}
                  </ExternalLinkCmp>
                  <p className="text-xs text-ink-tertiary mt-1">{finding.authors}</p>
                </div>
                <button
                  onClick={() => markRead(finding.id)}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
                  title="标记已读"
                  style={{ opacity: finding.is_read ? 0.3 : 1 }}
                >
                  <CheckCheck className="h-4 w-4 text-ink-tertiary" />
                </button>
              </div>

              {finding.relevance_reason ? (
                <div className="mt-2 flex items-start gap-1.5 rounded-xl px-3 py-2" style={{ background: "var(--rc-chip-bg)" }}>
                  <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#FF9500" }} />
                  <p className="text-xs leading-5 text-ink-secondary">{finding.relevance_reason}</p>
                </div>
              ) : null}

              {finding.abstract_snippet ? (
                <p className="mt-2 text-xs leading-5 text-ink-tertiary line-clamp-2">{finding.abstract_snippet}</p>
              ) : null}

              <div className="mt-2 flex items-center gap-3">
                <ExternalLinkCmp
                  href={finding.abs_url}
                  className="inline-flex items-center gap-1 text-xs font-medium text-apple-blue hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  查看摘要
                </ExternalLinkCmp>
                <ExternalLinkCmp
                  href={finding.pdf_url}
                  className="inline-flex items-center gap-1 text-xs font-medium text-apple-blue hover:underline"
                >
                  PDF
                </ExternalLinkCmp>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
