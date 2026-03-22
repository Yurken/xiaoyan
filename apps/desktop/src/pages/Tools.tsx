import { useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, FileSearch, Globe2, Search, Sparkles, Wrench } from "lucide-react";
import { Badge, Button, Card, Input, Textarea } from "@research-copilot/ui";
import type { ArxivRankingMode, ArxivSearchResponse, CcfEntry, JournalPartitionEntry } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, WosIndexBadge, VenueTypeBadge } from "../components/CcfBadges";
import ExternalLink from "../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../lib/client";
import { YANWEB_FRIEND_LINK_SECTIONS, YANWEB_FRIEND_LINK_TOTAL } from "../lib/yanweb-links";

const insetShadow = "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF";

const ARXIV_MODE_OPTIONS: Array<{ value: ArxivRankingMode; label: string; description: string }> = [
  {
    value: "relevance",
    label: "最相关",
    description: "优先找和关键词最贴合、最适合当前阅读的论文。",
  },
  {
    value: "quality",
    label: "质量预测",
    description: "优先找摘要信息密度、实验信号和潜在影响更强的论文。",
  },
];

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function truncateText(value: string, maxChars = 280) {
  const normalized = value.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function scoreVariant(score: number) {
  if (score >= 85) return "success" as const;
  if (score >= 70) return "info" as const;
  if (score >= 55) return "warning" as const;
  return "default" as const;
}

function friendLinkSectionId(index: number) {
  return `yanweb-friend-links-${index + 1}`;
}

function friendLinkInitial(value: string) {
  return value.trim().slice(0, 1) || "?";
}

export default function Tools() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CcfEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const [journalQuery, setJournalQuery] = useState("");
  const [journalMatches, setJournalMatches] = useState<JournalPartitionEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState("");
  const [journalSearched, setJournalSearched] = useState(false);

  const [arxivQuery, setArxivQuery] = useState("");
  const [arxivDays, setArxivDays] = useState("14");
  const [arxivLimit, setArxivLimit] = useState("6");
  const [arxivMode, setArxivMode] = useState<ArxivRankingMode>("relevance");
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState("");
  const [arxivSearched, setArxivSearched] = useState(false);
  const [arxivResult, setArxivResult] = useState<ArxivSearchResponse | null>(null);
  const arxivLastSearchAt = useRef<number>(0);

  const currentMode = useMemo(
    () => ARXIV_MODE_OPTIONS.find((item) => item.value === arxivMode) ?? ARXIV_MODE_OPTIONS[0],
    [arxivMode]
  );

  const handleLookup = async () => {
    if (!query.trim() || loading) return;

    try {
      setLoading(true);
      setError("");
      setSearched(true);
      const result = await apiClient.ccf.lookup(query.trim(), 10);
      setMatches(result.matches ?? []);
    } catch (nextError) {
      setMatches([]);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const handleArxivSearch = async () => {
    if (!arxivQuery.trim() || arxivLoading) return;
    const now = Date.now();
    if (now - arxivLastSearchAt.current < 3000) return;
    arxivLastSearchAt.current = now;

    const days = Number(arxivDays);
    const limit = Number(arxivLimit);

    try {
      setArxivLoading(true);
      setArxivError("");
      setArxivSearched(true);
      const result = await apiClient.arxiv.search(
        arxivQuery.trim(),
        Number.isFinite(days) ? days : 14,
        Number.isFinite(limit) ? limit : 6,
        arxivMode
      );
      setArxivResult(result);
    } catch (nextError) {
      setArxivResult(null);
      setArxivError(formatErrorMessage(nextError));
    } finally {
      setArxivLoading(false);
    }
  };

  const handleJournalLookup = async () => {
    if (!journalQuery.trim() || journalLoading) return;

    try {
      setJournalLoading(true);
      setJournalError("");
      setJournalSearched(true);
      const result = await apiClient.journals.lookup(journalQuery.trim(), 10);
      setJournalMatches(result.matches ?? []);
    } catch (nextError) {
      setJournalMatches([]);
      setJournalError(formatErrorMessage(nextError));
    } finally {
      setJournalLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">实用工具</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          内置期刊分区查询、CCF 目录查询、arXiv 智能检索，并补充一组按分类整理的科研友链。arXiv 结果会优先使用你当前项目里的模型设置做分析与重排。
        </p>
      </div>

      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-primary">arXiv 智能检索</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              输入关键词、最近时间窗口和返回篇数，自动从 arXiv 抓取候选论文，并按“最相关”或“质量预测”筛出前几篇。
            </p>
          </div>
        </div>

        <Textarea
          value={arxivQuery}
          onChange={(event) => setArxivQuery(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              void handleArxivSearch();
            }
          }}
          rows={3}
          placeholder={"例如：agent memory, tool use, planning\n支持逗号、分号或换行分隔多个关键词"}
          label="关键词"
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="最近天数"
            type="number"
            min={1}
            max={365}
            value={arxivDays}
            onChange={(event) => setArxivDays(event.target.value)}
            placeholder="14"
          />
          <Input
            label="返回篇数"
            type="number"
            min={1}
            max={20}
            value={arxivLimit}
            onChange={(event) => setArxivLimit(event.target.value)}
            placeholder="6"
          />
          <div className="w-full">
            <label className="block text-xs font-medium text-ink-tertiary mb-1.5 ml-1">排序方式</label>
            <select
              value={arxivMode}
              onChange={(event) => setArxivMode(event.target.value as ArxivRankingMode)}
              className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary outline-none border-0"
              style={{ background: "#E8ECF0", boxShadow: insetShadow }}
            >
              {ARXIV_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs leading-5 text-ink-tertiary">
            当前模式：<span className="font-medium text-ink-secondary">{currentMode.label}</span>
            {`，${currentMode.description}`}
          </p>
          <Button onClick={() => void handleArxivSearch()} loading={arxivLoading} disabled={!arxivQuery.trim()}>
            <FileSearch className="h-4 w-4" />
            检索 arXiv
          </Button>
        </div>

        {arxivError && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{arxivError}</span>
          </div>
        )}
      </Card>

      {arxivResult ? (
        <div className="space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{arxivResult.ranking_mode === "quality" ? "质量预测" : "最相关"}</Badge>
              <Badge variant={arxivResult.llm_used ? "success" : "warning"}>
                {arxivResult.llm_used ? "已使用当前模型设置" : "模型未启用，已降级启发式排序"}
              </Badge>
              <Badge variant="default">{`候选 ${arxivResult.candidate_count} 篇`}</Badge>
              <Badge variant="default">{`返回 ${arxivResult.papers.length} 篇`}</Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-primary">{arxivResult.overall_summary}</p>
              <p className="text-sm leading-6 text-ink-secondary">{arxivResult.ranking_note}</p>
              <p className="text-xs leading-5 text-ink-tertiary">{arxivResult.disclaimer}</p>
            </div>
          </Card>

          {arxivResult.papers.length > 0 ? (
            <div className="space-y-3">
              {arxivResult.papers.map((paper, index) => (
                <Card key={`${paper.arxiv_id}-${index}`} padding="md" className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={scoreVariant(paper.score)}>{`${paper.score} 分`}</Badge>
                        {paper.category ? <Badge variant="default">{paper.category}</Badge> : null}
                        {paper.published_at ? (
                          <Badge variant="default">{formatDate(paper.published_at)}</Badge>
                        ) : null}
                      </div>
                      <ExternalLink
                        href={paper.abs_url}
                        className="text-base font-semibold leading-7 text-ink-primary hover:text-apple-blue hover:underline"
                      >
                        {paper.title}
                      </ExternalLink>
                      {paper.title_zh ? (
                        <p className="text-sm font-medium text-ink-secondary">{paper.title_zh}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ExternalLink
                        href={paper.abs_url}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                        title="打开 arXiv 摘要页"
                      >
                        abs
                      </ExternalLink>
                      <ExternalLink
                        href={paper.pdf_url}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                        title="打开 arXiv PDF"
                      >
                        pdf
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
                <p className="mt-1 text-sm text-ink-tertiary">
                  建议增加最近天数，或改用更具体的研究主题关键词。
                </p>
              </div>
            </Card>
          )}
        </div>
      ) : arxivSearched && !arxivLoading && !arxivError ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">还没有结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">检查关键词和时间窗口后重试。</p>
          </div>
        </Card>
      ) : null}

      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">期刊分区查询</p>
            <p className="mt-1 text-xs text-ink-tertiary">支持期刊名或 ISSN，返回 WoS 收录、JCR 分区和中科院分区。</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <Input
              value={journalQuery}
              onChange={(event) => setJournalQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleJournalLookup();
                }
              }}
              placeholder="输入期刊名或 ISSN"
            />
          </div>
          <Button onClick={() => void handleJournalLookup()} loading={journalLoading} disabled={!journalQuery.trim()}>
            <FileSearch className="h-4 w-4" />
            查询分区
          </Button>
        </div>

        {journalError && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{journalError}</span>
          </div>
        )}
      </Card>

      {journalMatches.length > 0 ? (
        <div className="space-y-3">
          {journalMatches.map((match, index) => (
            <Card key={`${match.title}-${match.issn}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{match.title}</p>
                {match.indexes.map((item) => (
                  <WosIndexBadge key={`${match.title}-${item}`} index={item} />
                ))}
                <JcrQuartileBadge quartile={match.jcr_quartile} />
                <CasQuartileBadge quartile={match.cas_quartile} />
                <CasTopBadge top={match.cas_top} />
                {match.open_access ? <Badge variant="success">OA</Badge> : null}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {[match.publisher, match.issn ? `ISSN ${match.issn}` : "", match.eissn ? `eISSN ${match.eissn}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-xs leading-5 text-ink-tertiary">
                {[match.jcr_category, match.jif ? `JIF ${match.jif}` : "", match.jif_rank ? `排名 ${match.jif_rank}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {match.wos_categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {match.wos_categories.slice(0, 6).map((item) => (
                    <Badge key={`${match.title}-${item}`} variant="default">
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : journalSearched && !journalLoading && !journalError ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">没有匹配的期刊分区</p>
            <p className="mt-1 text-sm text-ink-tertiary">建议改用更完整的期刊名或 ISSN 重试。</p>
          </div>
        </Card>
      ) : null}

      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">CCF 评级查询</p>
            <p className="mt-1 text-xs text-ink-tertiary">支持示例：`CVPR`、`TKDE`、`ACM SIGMOD Conference`。</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleLookup();
                }
              }}
              placeholder="输入会议或期刊名称"
            />
          </div>
          <Button onClick={() => void handleLookup()} loading={loading} disabled={!query.trim()}>
            <Search className="h-4 w-4" />
            查询 CCF
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map((match, index) => (
            <Card key={`${match.full_name}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ExternalLink
                  href={match.url}
                  className="text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
                >
                  {match.full_name}
                </ExternalLink>
                <CcfRatingBadge rating={match.rating} />
                <VenueTypeBadge type={match.kind} />
                {match.label && <Badge variant="default">{match.label}</Badge>}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {match.area}
                {match.publisher ? ` · ${match.publisher}` : ""}
              </p>
            </Card>
          ))}
        </div>
      ) : searched && !loading && !error ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">没有匹配结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">建议改用官方简称或更完整的全称重试。</p>
          </div>
        </Card>
      ) : null}

      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Globe2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink-primary">科研友链</p>
              <Badge variant="default">{`${YANWEB_FRIEND_LINK_TOTAL} 条`}</Badge>
              <Badge variant="default">{`${YANWEB_FRIEND_LINK_SECTIONS.length} 个分类`}</Badge>
            </div>
            <p className="text-xs leading-5 text-ink-tertiary">
              基于 `yanweb.top` 当前页面整理的外部友链快照，只保留图标和超链接，点击后会直接在系统浏览器打开。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
            <a
              key={section.title}
              href={`#${friendLinkSectionId(index)}`}
              className="inline-flex items-center gap-2 rounded-full bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
            >
              <span>{section.title}</span>
              <span className="text-ink-tertiary">{section.items.length}</span>
            </a>
          ))}
        </div>

        <div className="space-y-6">
          {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
            <section key={section.title} id={friendLinkSectionId(index)} className="space-y-3 scroll-mt-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{section.title}</p>
                <Badge variant="default">{`${section.items.length} 条`}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {section.items.map((item) => (
                  <ExternalLink
                    key={`${section.title}-${item.name}-${item.href}`}
                    href={item.href}
                    title={`${item.name} · ${item.href}`}
                    className="group flex items-center gap-3 rounded-2xl bg-white/45 px-3 py-3 transition hover:bg-white/70"
                  >
                    <div
                      className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#E8ECF0] text-sm font-semibold text-ink-secondary"
                      style={{ boxShadow: insetShadow }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center">
                        {friendLinkInitial(item.name)}
                      </span>
                      <img
                        src={item.icon}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="relative h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.opacity = "0";
                        }}
                      />
                    </div>
                    <span className="min-w-0 text-sm leading-5 text-ink-primary group-hover:text-apple-blue group-hover:underline">
                      {item.name}
                    </span>
                  </ExternalLink>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
