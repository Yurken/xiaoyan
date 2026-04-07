import { CalendarDays, Search } from "lucide-react";
import { Badge, Card } from "@research-copilot/ui";
import type { ArxivSearchResponse } from "@research-copilot/types";
import ExternalLink from "../../components/ExternalLink";
import { formatDate, scoreVariant, truncateText } from "./shared";

interface AppliedFilterEntry {
  label: string;
  values: string[];
}

interface ArxivSearchResultsProps {
  result: ArxivSearchResponse | null;
  appliedFilters: AppliedFilterEntry[];
  searched: boolean;
  loading: boolean;
  error: string;
  expressionLabel: string;
  emptyMatchHint: string;
  emptySearchHint: string;
  detailActionLabel: string;
  detailActionTitle: string;
  pdfActionLabel: string;
  pdfActionTitle: string;
}

export function ArxivSearchResults({
  result,
  appliedFilters,
  searched,
  loading,
  error,
  expressionLabel,
  emptyMatchHint,
  emptySearchHint,
  detailActionLabel,
  detailActionTitle,
  pdfActionLabel,
  pdfActionTitle,
}: ArxivSearchResultsProps) {
  if (result) {
    return (
      <div className="space-y-4">
        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{result.ranking_mode === "quality" ? "质量预测" : "最相关"}</Badge>
            <Badge variant={result.llm_used ? "success" : "warning"}>
              {result.llm_used ? "已使用当前模型设置" : "模型未启用，已降级启发式排序"}
            </Badge>
            <Badge variant="default">{`候选 ${result.candidate_count} 篇`}</Badge>
            <Badge variant="default">{`返回 ${result.papers.length} 篇`}</Badge>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink-primary">{result.overall_summary}</p>
            <p className="text-sm leading-6 text-ink-secondary">{result.ranking_note}</p>
            <p className="text-xs leading-5 text-ink-tertiary">{result.disclaimer}</p>
          </div>

          {appliedFilters.length > 0 ? (
            <div className="space-y-2 rounded-2xl bg-white/40 px-3 py-3">
              <p className="text-xs font-semibold text-ink-secondary">本次检索条件</p>
              <div className="flex flex-wrap gap-2">
                {appliedFilters.flatMap((entry) =>
                  entry.values.map((value) => (
                    <Badge key={`${entry.label}-${value}`} variant="default">
                      {`${entry.label}：${value}`}
                    </Badge>
                  ))
                )}
              </div>
              <p className="text-[11px] leading-5 text-ink-tertiary">{expressionLabel}</p>
              <p className="break-all rounded-2xl bg-white/55 px-3 py-2 font-mono text-[11px] leading-5 text-ink-tertiary">
                {result.search_expression}
              </p>
            </div>
          ) : null}
        </Card>

        {result.papers.length > 0 ? (
          <div className="space-y-3">
            {result.papers.map((paper, index) => (
              <Card key={`${paper.arxiv_id}-${index}`} padding="md" className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={scoreVariant(paper.score)}>{`${paper.score} 分`}</Badge>
                      {paper.category ? <Badge variant="default">{paper.category}</Badge> : null}
                      {paper.published_at ? <Badge variant="default">{formatDate(paper.published_at)}</Badge> : null}
                    </div>
                    <ExternalLink
                      href={paper.abs_url}
                      className="text-base font-semibold leading-7 text-ink-primary hover:text-apple-blue hover:underline"
                    >
                      {paper.title}
                    </ExternalLink>
                    {paper.title_zh ? <p className="text-sm font-medium text-ink-secondary">{paper.title_zh}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ExternalLink
                      href={paper.abs_url}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                      title={detailActionTitle}
                    >
                      {detailActionLabel}
                    </ExternalLink>
                    <ExternalLink
                      href={paper.pdf_url}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                      title={pdfActionTitle}
                    >
                      {pdfActionLabel}
                    </ExternalLink>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs leading-5 text-ink-tertiary">{paper.authors || "作者信息缺失"}</p>
                  {paper.tldr_zh ? (
                    <p className="rounded-2xl bg-white/45 px-3 py-2 text-sm leading-6 text-ink-secondary">
                      {paper.tldr_zh}
                    </p>
                  ) : null}
                  <p className="text-sm leading-6 text-ink-secondary">{paper.reason}</p>
                  <p className="text-sm leading-6 text-ink-tertiary">{truncateText(paper.abstract_text)}</p>
                </div>

                {paper.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {paper.tags.map((tag) => (
                      <Badge key={`${paper.arxiv_id}-${tag}`} variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="h-8 w-8 text-ink-tertiary" />
            <div>
              <p className="font-medium text-ink-secondary">当前条件下没有匹配论文</p>
              <p className="mt-1 text-sm text-ink-tertiary">{emptyMatchHint}</p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (searched && !loading && !error) {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <Search className="h-8 w-8 text-ink-tertiary" />
        <div>
          <p className="font-medium text-ink-secondary">暂无结果</p>
          <p className="mt-1 text-sm text-ink-tertiary">{emptySearchHint}</p>
        </div>
      </Card>
    );
  }

  return null;
}
