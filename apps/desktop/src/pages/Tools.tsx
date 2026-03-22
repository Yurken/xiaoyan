import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, CalendarDays, ChevronDown, ChevronUp, FileSearch, Globe2, Search, Sparkles } from "lucide-react";
import { Badge, Button, Card, Input, Textarea } from "@research-copilot/ui";
import type { ArxivRankingMode, ArxivSearchRequest, ArxivSearchResponse, SourceLookupSection } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, WosIndexBadge, VenueTypeBadge } from "../components/CcfBadges";
import ExternalLink from "../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../lib/client";
import { YANWEB_FRIEND_LINK_SECTIONS, YANWEB_FRIEND_LINK_TOTAL } from "../lib/yanweb-links";

const insetShadow = "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF";
const raisedShadow = "4px 4px 10px #C8CDD3, -4px -4px 10px #FFFFFF";

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

function splitStructuredInput(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[，,；;\n]/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function hasStructuredArxivTerms(request: ArxivSearchRequest) {
  return Boolean(
    request.all_terms?.length ||
      request.title_terms?.length ||
      request.abstract_terms?.length ||
      request.authors?.length ||
      request.categories?.length ||
      request.comments_terms?.length ||
      request.journal_ref_terms?.length
  );
}

function buildAppliedFilterEntries(filters?: ArxivSearchRequest | null) {
  if (!filters) return [];

  return [
    { label: "研究主题", values: filters.topic?.trim() ? [filters.topic.trim()] : [] },
    { label: "通用词(all)", values: filters.all_terms ?? [] },
    { label: "标题词(ti)", values: filters.title_terms ?? [] },
    { label: "摘要词(abs)", values: filters.abstract_terms ?? [] },
    { label: "作者(au)", values: filters.authors ?? [] },
    { label: "分类(cat)", values: filters.categories ?? [] },
    { label: "备注(co)", values: filters.comments_terms ?? [] },
    { label: "期刊/jr", values: filters.journal_ref_terms ?? [] },
    { label: "排除词", values: filters.exclude_terms ?? [] },
  ].filter((entry) => entry.values.length > 0);
}

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
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceSections, setSourceSections] = useState<SourceLookupSection[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceSearched, setSourceSearched] = useState(false);

  const [arxivTopic, setArxivTopic] = useState("");
  const [arxivAllTerms, setArxivAllTerms] = useState("");
  const [arxivTitleTerms, setArxivTitleTerms] = useState("");
  const [arxivAbstractTerms, setArxivAbstractTerms] = useState("");
  const [arxivAuthors, setArxivAuthors] = useState("");
  const [arxivCategories, setArxivCategories] = useState("");
  const [arxivCommentsTerms, setArxivCommentsTerms] = useState("");
  const [arxivJournalTerms, setArxivJournalTerms] = useState("");
  const [arxivExcludeTerms, setArxivExcludeTerms] = useState("");
  const [arxivDays, setArxivDays] = useState("14");
  const [arxivLimit, setArxivLimit] = useState("6");
  const [arxivMode, setArxivMode] = useState<ArxivRankingMode>("relevance");
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState("");
  const [arxivSearched, setArxivSearched] = useState(false);
  const [arxivResult, setArxivResult] = useState<ArxivSearchResponse | null>(null);
  const arxivLastSearchAt = useRef<number>(0);
  const [friendLinkPanelOpen, setFriendLinkPanelOpen] = useState(false);
  const [openFriendSections, setOpenFriendSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => [section.title, index === 0]))
  );

  const currentMode = useMemo(
    () => ARXIV_MODE_OPTIONS.find((item) => item.value === arxivMode) ?? ARXIV_MODE_OPTIONS[0],
    [arxivMode]
  );
  const arxivRequest = useMemo<ArxivSearchRequest>(
    () => ({
      topic: arxivTopic.trim(),
      all_terms: splitStructuredInput(arxivAllTerms),
      title_terms: splitStructuredInput(arxivTitleTerms),
      abstract_terms: splitStructuredInput(arxivAbstractTerms),
      authors: splitStructuredInput(arxivAuthors),
      categories: splitStructuredInput(arxivCategories),
      comments_terms: splitStructuredInput(arxivCommentsTerms),
      journal_ref_terms: splitStructuredInput(arxivJournalTerms),
      exclude_terms: splitStructuredInput(arxivExcludeTerms),
    }),
    [
      arxivAbstractTerms,
      arxivAllTerms,
      arxivAuthors,
      arxivCategories,
      arxivCommentsTerms,
      arxivExcludeTerms,
      arxivJournalTerms,
      arxivTitleTerms,
      arxivTopic,
    ]
  );
  const arxivHasSearchTerms = useMemo(() => hasStructuredArxivTerms(arxivRequest), [arxivRequest]);
  const arxivAppliedFilters = useMemo(() => buildAppliedFilterEntries(arxivResult?.applied_filters), [arxivResult]);
  const journalSection = useMemo(
    () => sourceSections.find((section) => section.key === "journal_partition"),
    [sourceSections]
  );
  const ccfSection = useMemo(
    () => sourceSections.find((section) => section.key === "ccf"),
    [sourceSections]
  );
  const expandedFriendSectionCount = useMemo(
    () => YANWEB_FRIEND_LINK_SECTIONS.filter((section) => openFriendSections[section.title]).length,
    [openFriendSections]
  );
  const allFriendSectionsExpanded = expandedFriendSectionCount === YANWEB_FRIEND_LINK_SECTIONS.length;

  const toggleFriendSection = (title: string) => {
    setOpenFriendSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const setAllFriendSections = (open: boolean) => {
    setOpenFriendSections(Object.fromEntries(YANWEB_FRIEND_LINK_SECTIONS.map((section) => [section.title, open])));
  };

  const revealFriendSection = (title: string, index: number) => {
    setOpenFriendSections((prev) => ({ ...prev, [title]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(friendLinkSectionId(index))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleArxivKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      void handleArxivSearch();
    }
  };

  const handleArxivSearch = async () => {
    if (!arxivHasSearchTerms || arxivLoading) return;
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
        arxivRequest,
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

  const handleSourceLookup = async () => {
    const trimmed = sourceQuery.trim();
    if (!trimmed || sourceLoading) return;

    try {
      setSourceLoading(true);
      setSourceSearched(true);
      setSourceError("");
      const result = await apiClient.sources.lookup(trimmed, 10);
      setSourceSections(result.sections ?? []);
    } catch (nextError) {
      setSourceSections([]);
      setSourceError(formatErrorMessage(nextError));
    } finally {
      setSourceLoading(false);
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
              输入会按 arXiv 官方字段拆分：同一字段内多个值按 OR 合并，不同字段之间按 AND 组合，排除词走 ANDNOT。
            </p>
          </div>
        </div>

        <Textarea
          value={arxivTopic}
          onChange={(event) => setArxivTopic(event.target.value)}
          onKeyDown={handleArxivKeyDown}
          rows={2}
          placeholder="例如：想找最近两周里，tool-using LLM agents 中关于 memory / planning 的代表性新文"
          label="研究主题说明（可选，仅用于 LLM 重排理解需求）"
        />

        <div className="grid gap-3 xl:grid-cols-2">
          <Textarea
            value={arxivAllTerms}
            onChange={(event) => setArxivAllTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            rows={2}
            placeholder={"例如：agent memory, tool use\n支持逗号、分号或换行分隔"}
            label="通用关键词（all）"
          />
          <Textarea
            value={arxivTitleTerms}
            onChange={(event) => setArxivTitleTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            rows={2}
            placeholder="例如：planning, memory editing"
            label="标题关键词（ti）"
          />
          <Textarea
            value={arxivAbstractTerms}
            onChange={(event) => setArxivAbstractTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            rows={2}
            placeholder="例如：benchmark, long-term memory"
            label="摘要关键词（abs）"
          />
          <Input
            value={arxivAuthors}
            onChange={(event) => setArxivAuthors(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：Geoffrey Hinton, Percy Liang"
            label="作者（au）"
          />
          <Input
            value={arxivCategories}
            onChange={(event) => setArxivCategories(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：cs.AI, cs.LG, cs.CL"
            label="arXiv 分类（cat）"
          />
          <Input
            value={arxivCommentsTerms}
            onChange={(event) => setArxivCommentsTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：code, benchmark, workshop"
            label="备注关键词（co）"
          />
          <Input
            value={arxivJournalTerms}
            onChange={(event) => setArxivJournalTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：ICLR, ACL, NeurIPS"
            label="期刊/会议信息（jr）"
          />
          <Input
            value={arxivExcludeTerms}
            onChange={(event) => setArxivExcludeTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：robotics, medical imaging"
            label="排除词（ANDNOT）"
          />
        </div>

        <p className="text-xs leading-5 text-ink-tertiary">
          分类请填写 arXiv category id，例如 <span className="font-medium text-ink-secondary">cs.AI</span>、
          <span className="font-medium text-ink-secondary">cs.LG</span>、
          <span className="font-medium text-ink-secondary">stat.ML</span>。检索时会自动加入最近时间窗口的
          <span className="font-medium text-ink-secondary">submittedDate</span> 条件。
        </p>

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
          <Button onClick={() => void handleArxivSearch()} loading={arxivLoading} disabled={!arxivHasSearchTerms}>
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

            {arxivAppliedFilters.length > 0 ? (
              <div className="space-y-2 rounded-2xl bg-white/40 px-3 py-3">
                <p className="text-xs font-semibold text-ink-secondary">本次检索条件</p>
                <div className="flex flex-wrap gap-2">
                  {arxivAppliedFilters.flatMap((entry) =>
                    entry.values.map((value) => (
                      <Badge key={`${entry.label}-${value}`} variant="default">
                        {`${entry.label}：${value}`}
                      </Badge>
                    ))
                  )}
                </div>
                <p className="text-[11px] leading-5 text-ink-tertiary">官方 arXiv 查询式</p>
                <p className="break-all rounded-2xl bg-white/55 px-3 py-2 font-mono text-[11px] leading-5 text-ink-tertiary">
                  {arxivResult.search_expression}
                </p>
              </div>
            ) : null}
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
                  建议增加最近天数，或放宽标题词、摘要词和分类条件。
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
            <p className="mt-1 text-sm text-ink-tertiary">检查检索字段和时间窗口后重试。</p>
          </div>
        </Card>
      ) : null}

      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">刊会查询</p>
            <p className="mt-1 text-xs text-ink-tertiary">输入期刊/会议名称返回分区和 CCF 评级。</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <Input
              value={sourceQuery}
              onChange={(event) => setSourceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSourceLookup();
                }
              }}
              placeholder="输入会议、期刊名称或 ISSN"
            />
          </div>
          <Button onClick={() => void handleSourceLookup()} loading={sourceLoading} disabled={!sourceQuery.trim()}>
            <Search className="h-4 w-4" />
            查询
          </Button>
        </div>

        {sourceError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{sourceError}</span>
          </div>
        ) : null}
      </Card>

      {journalSection && journalSection.items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">{journalSection.title}</Badge>
            <p className="text-sm font-semibold text-ink-primary">WoS / JCR / 中科院</p>
          </div>
          {journalSection.items.map((item, index) => (
            <Card key={`${item.source}-${item.name}-${item.issn}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{item.name}</p>
                {item.indexes.map((indexName) => (
                  <WosIndexBadge key={`${item.name}-${indexName}`} index={indexName} />
                ))}
                <JcrQuartileBadge quartile={item.jcr_quartile} />
                <CasQuartileBadge quartile={item.cas_quartile} />
                <CasTopBadge top={item.cas_top} />
                {item.open_access ? <Badge variant="success">OA</Badge> : null}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {[item.publisher, item.issn ? `ISSN ${item.issn}` : "", item.eissn ? `eISSN ${item.eissn}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-xs leading-5 text-ink-tertiary">
                {[item.jcr_category, item.jif ? `JIF ${item.jif}` : "", item.jif_rank ? `排名 ${item.jif_rank}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {item.wos_categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.wos_categories.slice(0, 6).map((category) => (
                    <Badge key={`${item.name}-${category}`} variant="default">
                      {category}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {ccfSection && ccfSection.items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">{ccfSection.title}</Badge>
            <p className="text-sm font-semibold text-ink-primary">会议 / 期刊推荐级别</p>
          </div>
          {ccfSection.items.map((item, index) => (
            <Card key={`${item.source}-${item.name}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ExternalLink
                  href={item.url}
                  className="text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
                >
                  {item.name}
                </ExternalLink>
                <CcfRatingBadge rating={item.rating} />
                <VenueTypeBadge type={item.entity_type} />
                {item.label && <Badge variant="default">{item.label}</Badge>}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {item.area}
                {item.publisher ? ` · ${item.publisher}` : ""}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {sourceSearched && !sourceLoading && !sourceError && sourceSections.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">没有匹配结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">建议改用更完整的期刊名、会议全称或 ISSN 重试。</p>
          </div>
        </Card>
      ) : null}

      <Card padding="md" className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Globe2 className="h-5 w-5" />
          </div>
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary">科研友链</p>
            <p className="text-xs text-ink-tertiary">{`共 ${YANWEB_FRIEND_LINK_TOTAL} 条 · ${YANWEB_FRIEND_LINK_SECTIONS.length} 个分类`}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFriendLinkPanelOpen((v) => !v)}
              className="inline-flex items-center rounded-full bg-white/45 px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
              aria-label={friendLinkPanelOpen ? "收起科研友链" : "展开科研友链"}
            >
              {friendLinkPanelOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {friendLinkPanelOpen && (
              <button
                type="button"
                onClick={() => setAllFriendSections(!allFriendSectionsExpanded)}
                className="inline-flex items-center rounded-full bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
                aria-label={allFriendSectionsExpanded ? "收起全部友链分类" : "展开全部友链分类"}
              >
                {allFriendSectionsExpanded ? "收起全部" : "展开全部"}
              </button>
            )}
          </div>
        </div>

        {friendLinkPanelOpen && <>
        <div className="flex flex-wrap gap-2">
          {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
            <button
              type="button"
              key={section.title}
              onClick={() => revealFriendSection(section.title, index)}
              className="inline-flex items-center gap-2 rounded-full bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
              aria-expanded={openFriendSections[section.title] ?? false}
              aria-controls={friendLinkSectionId(index)}
            >
              <span>{section.title}</span>
              <span className="text-ink-tertiary">{section.items.length}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
            <section
              key={section.title}
              id={friendLinkSectionId(index)}
              className="scroll-mt-6 overflow-hidden rounded-3xl border border-white/55 bg-white/25"
              style={{ boxShadow: "inset 1px 1px 0 rgba(255, 255, 255, 0.72)" }}
            >
              <button
                type="button"
                onClick={() => toggleFriendSection(section.title)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/20"
                aria-expanded={openFriendSections[section.title] ?? false}
                aria-controls={`${friendLinkSectionId(index)}-panel`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-primary">{section.title}</p>
                  <Badge variant="default">{`${section.items.length} 条`}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-tertiary">
                  <span>{openFriendSections[section.title] ? "收起" : "展开"}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      openFriendSections[section.title] ? "rotate-180 text-apple-blue" : ""
                    }`}
                  />
                </div>
              </button>

              {openFriendSections[section.title] ? (
                <div id={`${friendLinkSectionId(index)}-panel`} className="border-t border-white/55 px-1 pb-1 pt-3">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {section.items.map((item) => (
                      <ExternalLink
                        key={`${section.title}-${item.name}-${item.href}`}
                        href={item.href}
                        title={`${item.name} · ${item.href}`}
                        className="group flex items-center gap-3 rounded-2xl bg-white/45 px-3 py-3 transition hover:bg-white/70"
                      >
                        <div
                          className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF1F5] text-sm font-semibold text-ink-secondary transition-transform duration-150 group-hover:-translate-y-0.5"
                          style={{ boxShadow: raisedShadow }}
                        >
                          <span
                            className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
                            style={{ opacity: item.icon ? 0 : 1 }}
                          >
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
                              const fallback = event.currentTarget.parentElement?.querySelector("span");
                              if (fallback instanceof HTMLElement) {
                                fallback.style.opacity = "1";
                              }
                            }}
                          />
                        </div>
                        <span className="min-w-0 text-sm leading-5 text-ink-primary group-hover:text-apple-blue group-hover:underline">
                          {item.name}
                        </span>
                      </ExternalLink>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
        </>}
      </Card>
    </div>
  );
}
