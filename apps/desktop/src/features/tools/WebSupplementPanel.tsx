import { AlertCircle, Globe, Search } from "lucide-react";
import { Badge, Button, Card } from "@research-copilot/ui";
import type { WebSearchOutcome } from "@research-copilot/types";
import ExternalLink from "../../components/ExternalLink";
import { truncateText } from "./shared";

interface WebSupplementPanelProps {
  seedQuery: string;
  outcome: WebSearchOutcome | null;
  loading: boolean;
  error: string;
  searched: boolean;
  onRun: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  tavily: "Tavily",
  duckduckgo: "DuckDuckGo",
};

export function WebSupplementPanel({
  seedQuery,
  outcome,
  loading,
  error,
  searched,
  onRun,
}: WebSupplementPanelProps) {
  const trimmedSeed = seedQuery.trim();
  const hasSeed = trimmedSeed.length > 0;

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
          <Globe className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink-primary">网络补充结果</p>
          <p className="text-xs leading-5 text-ink-tertiary">
            学术数据源之外，按需补一份全网检索，覆盖预印本主页、项目仓库、博客与最新动态等内容。
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs leading-5 text-ink-tertiary">
          {hasSeed ? (
            <>
              检索词：<span className="font-medium text-ink-secondary">{trimmedSeed}</span>
            </>
          ) : (
            "先在上方填写检索词，再来补充全网结果。"
          )}
        </p>
        <Button onClick={onRun} loading={loading} disabled={!hasSeed}>
          <Search className="h-4 w-4" />
          联网补充检索
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {outcome ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{PROVIDER_LABEL[outcome.provider] ?? outcome.provider}</Badge>
            <Badge variant="default">{`${outcome.items.length} 条结果`}</Badge>
          </div>

          {outcome.note ? <p className="text-xs leading-5 text-ink-tertiary">{outcome.note}</p> : null}

          {outcome.answer ? (
            <p className="rounded-2xl bg-white/55 px-3 py-2 text-sm leading-6 text-ink-secondary">
              {outcome.answer}
            </p>
          ) : null}

          {outcome.items.length > 0 ? (
            <div className="space-y-2">
              {outcome.items.map((item, index) => (
                <div
                  key={`${item.url || item.title}-${index}`}
                  className="space-y-1 rounded-2xl bg-white/45 px-3 py-2"
                >
                  {item.url ? (
                    <ExternalLink
                      href={item.url}
                      className="text-sm font-semibold leading-6 text-ink-primary hover:text-apple-blue hover:underline"
                    >
                      {item.title || item.url}
                    </ExternalLink>
                  ) : (
                    <p className="text-sm font-semibold leading-6 text-ink-primary">{item.title}</p>
                  )}
                  {item.snippet ? (
                    <p className="text-xs leading-5 text-ink-tertiary">{truncateText(item.snippet)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-tertiary">未找到可补充的网络结果，可调整检索词后重试。</p>
          )}
        </div>
      ) : searched && !loading && !error ? (
        <p className="text-sm text-ink-tertiary">未找到可补充的网络结果，可调整检索词后重试。</p>
      ) : null}
    </Card>
  );
}
