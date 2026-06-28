import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { useState } from "react";
import type { ResearchFieldBriefing } from "@research-copilot/types";
import { Badge, Button, Card } from "@research-copilot/ui";
import ExternalLinkCmp from "../../components/ExternalLink";
import { formatGeneratedAt, formatPeriod } from "./shared";

interface FieldDynamicsBriefingCardProps {
  briefing: ResearchFieldBriefing;
  importingPaper: { briefingId: string; externalId: string } | null;
  importErrors: Record<string, string>;
  onImportPaper: (
    briefingId: string,
    externalId: string,
    source: string,
    title: string,
  ) => void;
  onMarkRead: (id: string) => void;
}

const sourceLabel: Record<string, string> = {
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
};

export function FieldDynamicsBriefingCard({
  briefing,
  importingPaper,
  importErrors,
  onImportPaper,
  onMarkRead,
}: FieldDynamicsBriefingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const period = formatPeriod(briefing.period_start, briefing.period_end);
  const generated = formatGeneratedAt(briefing.generated_at);

  return (
    <Card
      variant="inset"
      padding="md"
      className="transition-opacity"
      style={{ opacity: briefing.is_read ? 0.75 : 1 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-ink-primary">{briefing.interest_topic}</h3>
            {period ? <span className="text-xs text-ink-tertiary">{period}</span> : null}
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">生成于 {generated}</p>

          <p className="mt-3 text-sm leading-6 text-ink-secondary">{briefing.summary}</p>

          {briefing.trends.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {briefing.trends.map((trend, index) => (
                <Badge key={index} variant="info" className="font-medium">
                  {trend}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {!briefing.is_read ? (
          <button
            type="button"
            onClick={() => onMarkRead(briefing.id)}
            className="flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-ink-tertiary transition-colors hover:bg-black/5 hover:text-ink-primary dark:hover:bg-white/5"
          >
            标为已读
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-tertiary hover:text-ink-primary transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" /> 收起详情
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" /> 展开详情
            <span className="ml-1 text-[11px]">
              （{briefing.key_papers.length} 篇论文
              {briefing.upcoming_deadlines.length > 0
                ? ` · ${briefing.upcoming_deadlines.length} 个会议`
                : ""}
              ）
            </span>
          </>
        )}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-5">
          {briefing.key_papers.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
                关键论文
              </h4>
              <div className="space-y-2">
                {briefing.key_papers.map((paper) => {
                  const errorKey = `${briefing.id}:${paper.external_id}`;
                  const isImporting =
                    importingPaper?.briefingId === briefing.id &&
                    importingPaper?.externalId === paper.external_id;
                  return (
                    <Card key={paper.external_id} variant="flat" padding="sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <ExternalLinkCmp
                            href={paper.url || paper.pdf_url}
                            className="text-sm font-semibold text-ink-primary hover:text-brand-500 line-clamp-2"
                          >
                            {paper.title}
                          </ExternalLinkCmp>
                          <p className="text-[11px] text-ink-tertiary line-clamp-1">
                            {paper.authors}
                            {paper.published_at ? ` · ${paper.published_at}` : ""}
                          </p>
                          {paper.relevance_reason ? (
                            <p className="text-[11px] leading-4 text-ink-secondary mt-1">
                              {paper.relevance_reason}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={paper.relevance_score >= 80 ? "success" : "warning"}>
                          {paper.relevance_score}%
                        </Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="default">{sourceLabel[paper.source] ?? paper.source}</Badge>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={isImporting}
                          onClick={() =>
                            onImportPaper(briefing.id, paper.external_id, paper.source, paper.title)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                        >
                          {!isImporting ? <Download className="h-3 w-3" /> : null}
                          {isImporting ? "导入中…" : "导入"}
                        </Button>
                        {importErrors[errorKey] ? (
                          <span className="text-[11px] text-apple-red">
                            {importErrors[errorKey]}
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}

          {briefing.upcoming_deadlines.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
                相关会议截稿
              </h4>
              <div className="space-y-2">
                {briefing.upcoming_deadlines.map((deadline) => (
                  <Card key={deadline.external_id} variant="flat" padding="sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <ExternalLinkCmp
                          href={deadline.url}
                          className="text-sm font-semibold text-ink-primary hover:text-brand-500 line-clamp-1"
                        >
                          {deadline.name}
                        </ExternalLinkCmp>
                        <p className="text-[11px] text-ink-tertiary mt-0.5">
                          截稿：{deadline.deadline}
                        </p>
                      </div>
                      <Badge variant={deadline.days_remaining <= 14 ? "danger" : "purple"}>
                        剩余 {deadline.days_remaining} 天
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
