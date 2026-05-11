import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  FileSearch,
  GitBranch,
  Loader2,
  Settings2,
} from "lucide-react";
import { Badge, Button, Card, Input, MarkdownRenderer, Select } from "@research-copilot/ui";
import { CcfRatingBadge, VenueTypeBadge } from "../../components/CcfBadges";
import ExternalLink from "../../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { buildPaperSearchUrl, openLink } from "../../lib/links";
import { listen } from "@tauri-apps/api/event";
import { replaceAgentWording, toCapabilityModelName, type Paper, type ResearchInterest } from "@research-copilot/types";

type SurveyAgentStatus = "running" | "done" | "failed";

interface SurveyAgentState {
  id: string;
  name: string;
  role: string;
  status: SurveyAgentStatus;
  summary?: string;
  error?: string;
}

interface StructuredSurveyResult {
  query: string;
  report: {
    background?: string;
    development_timeline?: Array<{
      period?: string;
      milestone?: string;
      key_works?: string[];
      significance?: string;
    }>;
    major_methods?: Array<{
      name?: string;
      description?: string;
      representative_papers?: string[];
      pros?: string;
      cons?: string;
    }>;
    schools_of_thought?: Array<{
      name?: string;
      description?: string;
      representatives?: string[];
    }>;
    methodology_summary?: {
      mainstream?: string;
      emerging?: string;
      comparison?: string;
    };
    research_trends?: Array<{ trend?: string; signal?: string }>;
    controversies?: Array<{ topic?: string; positions?: string[] }>;
    challenges?: string[];
    research_gaps?: string[];
    future_directions?: string[];
    recommended_topics?: Array<{ topic?: string; why?: string; first_step?: string }>;
    overall_summary?: string;
    current_frontier?: string;
    earliest_period?: string;
  };
  papers: Array<{
    id: string;
    title: string;
    authors?: string;
    abstract?: string;
    year?: number;
    venue?: string;
    doi?: string;
    ccf_rating?: string;
    ccf_area?: string;
    ccf_type?: string;
    ccf_label?: string;
    ccf_publisher?: string;
    paper_url?: string;
    venue_url?: string;
  }>;
  formatted_citations?: string[];
  citation_format?: string;
  meta?: {
    time_range?: string;
    lit_types?: string;
    databases?: string;
    language?: string;
  };
}

const LIT_TYPE_OPTIONS = [
  { value: "期刊论文", label: "期刊论文" },
  { value: "会议论文", label: "会议论文" },
  { value: "学位论文", label: "学位论文" },
  { value: "预印本", label: "预印本" },
  { value: "专著", label: "专著" },
];

const DATABASE_OPTIONS = [
  "CNKI", "万方", "PubMed", "Web of Science", "Scopus", "IEEE Xplore", "arXiv", "ACM DL",
];

const CITATION_FORMATS = [
  { value: "gbt7714", label: "GB/T 7714（国标）" },
  { value: "apa", label: "APA" },
  { value: "mla", label: "MLA" },
  { value: "ieee", label: "IEEE" },
];

const LANGUAGE_OPTIONS = [
  { value: "both", label: "中英文均可" },
  { value: "zh", label: "仅中文" },
  { value: "en", label: "仅英文" },
];

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

function ToggleChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        selected
          ? "rc-accent-chip"
          : "border-nm-dark/15 bg-white/40 text-ink-secondary hover:text-ink-primary"
      }`}
    >
      {label}
    </button>
  );
}

export default function SurveyPanel({ hideInterestPanel = false }: { hideInterestPanel?: boolean }) {
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [interestPapers, setInterestPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  // Advanced options
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [litTypes, setLitTypes] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [citationFormat, setCitationFormat] = useState("gbt7714");
  const [language, setLanguage] = useState("both");

  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState("");
  const [agents, setAgents] = useState<SurveyAgentState[]>([]);
  const [structured, setStructured] = useState<StructuredSurveyResult | null>(null);
  const [error, setError] = useState("");
  const contentRef = useRef("");
  const requestIdRef = useRef<string | null>(null);
  const unlistenersRef = useRef<Array<() => void>>([]);

  const acceptRequest = (requestId?: string) => {
    if (!requestId) return true;
    if (!requestIdRef.current) {
      requestIdRef.current = requestId;
      return true;
    }
    return requestIdRef.current === requestId;
  };

  useEffect(() => {
    let cancelled = false;
    apiClient.knowledge.listInterests().then((data) => {
      if (!cancelled) setInterests(data);
    }).catch(() => {
      if (!cancelled) setInterests([]);
    });
    return () => { cancelled = true; };
  }, []);

  // 加载选中方向的论文列表
  useEffect(() => {
    if (!selectedInterestId) {
      setInterestPapers([]);
      setSelectedPaperIds([]);
      return;
    }
    let cancelled = false;
    setLoadingPapers(true);
    apiClient.papers.list(0, 200, selectedInterestId).then((data) => {
      if (!cancelled) {
        setInterestPapers(data);
        setSelectedPaperIds(data.map((p) => p.id));
        setLoadingPapers(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setInterestPapers([]);
        setSelectedPaperIds([]);
        setLoadingPapers(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedInterestId]);

  useEffect(() => {
    return () => { unlistenersRef.current.forEach((cleanup) => cleanup()); };
  }, []);

  const togglePaper = (id: string) => {
    setSelectedPaperIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleAllPapers = () => {
    setSelectedPaperIds((prev) =>
      prev.length === interestPapers.length ? [] : interestPapers.map((p) => p.id)
    );
  };

  const toggleLitType = (val: string) => {
    setLitTypes((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  };

  const toggleDatabase = (val: string) => {
    setDatabases((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  };

  const handleGenerate = async () => {
    if (!query.trim() || generating) return;

    unlistenersRef.current.forEach((cleanup) => cleanup());
    unlistenersRef.current = [];
    contentRef.current = "";
    requestIdRef.current = null;
    setContent("");
    setAgents([]);
    setStructured(null);
    setError("");
    setGenerating(true);

    const [unlistenDelta, unlistenDone, unlistenError, unlistenStructured, unlistenAgentStart] = await Promise.all([
      listen<{ request_id?: string; delta: string }>("survey:delta", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        contentRef.current += event.payload.delta;
        setContent(contentRef.current);
      }),
      listen<{ request_id?: string }>("survey:done", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        setGenerating(false);
      }),
      listen<{ request_id?: string; error: string }>("survey:error", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        setError(event.payload.error);
        setGenerating(false);
      }),
      listen<{
        request_id?: string;
        query: string;
        report: StructuredSurveyResult["report"];
        papers: StructuredSurveyResult["papers"];
        formatted_citations?: string[];
        citation_format?: string;
        meta?: StructuredSurveyResult["meta"];
      }>("survey:structured", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        setStructured({
          query: event.payload.query,
          report: event.payload.report,
          papers: event.payload.papers,
          formatted_citations: event.payload.formatted_citations,
          citation_format: event.payload.citation_format,
          meta: event.payload.meta,
        });
      }),
      listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_start", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        const nextAgent = event.payload.agent;
        setAgents((prev) => {
          const exists = prev.some((item) => item.id === nextAgent.id);
          if (exists) return prev.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent } : item));
          return [...prev, nextAgent];
        });
      }),
    ]);

    const [unlistenAgentComplete, unlistenAgentError] = await Promise.all([
      listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_complete", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        const nextAgent = event.payload.agent;
        setAgents((prev) => prev.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent, status: "done" } : item)));
      }),
      listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_error", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        const nextAgent = event.payload.agent;
        setAgents((prev) => prev.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent, status: "failed" } : item)));
        setError(nextAgent.error || "生成未完成，请稍后重试。");
        setGenerating(false);
      }),
    ]);

    unlistenersRef.current = [
      unlistenDelta, unlistenDone, unlistenError, unlistenStructured,
      unlistenAgentStart, unlistenAgentComplete, unlistenAgentError,
    ];

    try {
      await apiClient.survey.generate(
        query.trim(),
        20,
        timeFrom ? parseInt(timeFrom) : undefined,
        timeTo ? parseInt(timeTo) : undefined,
        litTypes.length > 0 ? litTypes : undefined,
        databases.length > 0 ? databases : undefined,
        citationFormat,
        language,
        selectedPaperIds.length > 0 ? selectedPaperIds : undefined,
      );
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      setGenerating(false);
    }
  };

  const citationFormatLabel = CITATION_FORMATS.find((f) => f.value === citationFormat)?.label ?? "GB/T 7714（国标）";
  const hasAdvancedSettings = !!(timeFrom || timeTo || litTypes.length > 0 || databases.length > 0);

  const allPapersSelected = interestPapers.length > 0 && selectedPaperIds.length === interestPapers.length;
  const somePapersSelected = selectedPaperIds.length > 0 && selectedPaperIds.length < interestPapers.length;

  // 生成区内容（输入 + 参数 + 结果）
  const generationArea = (
    <div className="min-w-0 flex-1 space-y-3">
      {/* ── 综述生成 Card ── */}
      <Card padding="sm" className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-primary">结构化文献综述生成</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              多能力域模型协作完成范围规划、发展脉络梳理与综述生成，并输出带参考文献格式的结构化结果。
            </p>
          </div>
          {interests.length > 0 && (
            <Select
              className="w-48 flex-shrink-0"
              prefix="研究主题："
              value={selectedInterestId}
              onChange={(v) => {
                setSelectedInterestId(v);
                if (v) {
                  const interest = interests.find((i) => i.id === v);
                  if (interest) setQuery(interest.topic);
                }
              }}
              options={[
                { value: "", label: "自由检索" },
                ...interests.map((interest) => ({
                  value: interest.id,
                  label: interestFolderName(interest),
                })),
              ]}
              placeholder="选择研究主题"
            />
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void handleGenerate(); }}
              placeholder="请输入研究问题，例如：Transformer attention 机制的发展"
              disabled={generating}
            />
          </div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            disabled={generating}
            className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
              advancedOpen
                ? "rc-accent-chip"
                : "border-nm-dark/15 bg-white/40 text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            生成参数
            {hasAdvancedSettings && !advancedOpen && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-apple-blue" />
            )}
          </button>
          <Button onClick={() => void handleGenerate()} loading={generating} disabled={!query.trim()}>
            <FileSearch className="h-4 w-4" />
            生成综述
          </Button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {/* ── 选中研究主题的论文选择区 ── */}
      {selectedInterestId && (
        <Card padding="sm" className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-tertiary">
              该方向论文库
              {interestPapers.length > 0 && (
                <span className="ml-1 font-normal text-ink-tertiary/70">
                  （{selectedPaperIds.length}/{interestPapers.length}）
                </span>
              )}
            </p>
            {interestPapers.length > 0 && (
              <button
                type="button"
                onClick={toggleAllPapers}
                className="text-[11px] text-apple-blue hover:underline"
              >
                {allPapersSelected ? "取消全选" : "全选"}
              </button>
            )}
          </div>

          {loadingPapers ? (
            <div className="flex items-center gap-1.5 py-2 text-xs text-ink-tertiary">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在加载…
            </div>
          ) : interestPapers.length === 0 ? (
            <p className="text-xs text-ink-tertiary">该研究主题下暂无论文</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-nm-dark/10">
              {interestPapers.map((paper, index) => {
                const checked = selectedPaperIds.includes(paper.id);
                const isLast = index === interestPapers.length - 1;
                return (
                  <label
                    key={paper.id}
                    className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors ${
                      isLast ? "" : "border-b border-nm-dark/8"
                    } ${checked ? "bg-apple-blue/5" : "hover:bg-white/50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePaper(paper.id)}
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-apple-blue"
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs leading-4 text-ink-primary">{paper.title}</p>
                      {(paper.year || paper.venue) && (
                        <p className="mt-0.5 truncate text-[11px] text-ink-tertiary">
                          {[paper.year, paper.venue].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {somePapersSelected && (
            <p className="text-[11px] text-ink-tertiary">
              当前仅使用已勾选的 {selectedPaperIds.length} 篇论文生成综述
            </p>
          )}
        </Card>
      )}

      {/* ── 生成参数配置 Card ── */}
      {advancedOpen && (
        <Card padding="sm" className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-apple-blue" />
            <p className="text-sm font-semibold text-ink-primary">综述生成参数</p>
            <p className="ml-1 text-xs text-ink-tertiary">以下参数会在点击“生成综述”后生效</p>
          </div>

          {/* Time range */}
          <div>
            <p className="mb-2 text-xs font-medium text-ink-secondary">文献时间范围</p>
            <div className="flex items-center gap-2">
              <Input
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                placeholder="起始年份，如 2015"
                disabled={generating}
                className="w-36"
              />
              <span className="text-xs text-ink-tertiary">至</span>
              <Input
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
                placeholder="截止年份，如 2024"
                disabled={generating}
                className="w-36"
              />
              {(timeFrom || timeTo) && (
                <button
                  type="button"
                  onClick={() => { setTimeFrom(""); setTimeTo(""); }}
                  className="text-xs text-ink-tertiary hover:text-ink-secondary"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* Literature types */}
          <div>
            <p className="mb-2 text-xs font-medium text-ink-secondary">文献类型</p>
            <div className="flex flex-wrap gap-2">
              {LIT_TYPE_OPTIONS.map((opt) => (
                <ToggleChip
                  key={opt.value}
                  label={opt.label}
                  selected={litTypes.includes(opt.value)}
                  onClick={() => toggleLitType(opt.value)}
                />
              ))}
            </div>
            {litTypes.length === 0 && (
              <p className="mt-1 text-[11px] text-ink-tertiary">未选择则不限类型</p>
            )}
          </div>

          {/* Databases */}
          <div>
            <p className="mb-2 text-xs font-medium text-ink-secondary">检索数据库偏好</p>
            <div className="flex flex-wrap gap-2">
              {DATABASE_OPTIONS.map((db) => (
                <ToggleChip
                  key={db}
                  label={db}
                  selected={databases.includes(db)}
                  onClick={() => toggleDatabase(db)}
                />
              ))}
            </div>
            {databases.length === 0 && (
              <p className="mt-1 text-[11px] text-ink-tertiary">未选择则不限数据库</p>
            )}
          </div>

          {/* Citation format + language */}
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-ink-secondary">参考文献格式</p>
              <div className="flex flex-wrap gap-2">
                {CITATION_FORMATS.map((f) => (
                  <ToggleChip
                    key={f.value}
                    label={f.label}
                    selected={citationFormat === f.value}
                    onClick={() => setCitationFormat(f.value)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-ink-secondary">语言范围</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <ToggleChip
                    key={l.value}
                    label={l.label}
                    selected={language === l.value}
                    onClick={() => setLanguage(l.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Active settings summary */}
          {hasAdvancedSettings && (
            <div className="rounded-xl border border-nm-dark/10 bg-white/40 px-3 py-2 text-[11px] text-ink-tertiary">
              {timeFrom || timeTo ? <span>时间：{timeFrom || "不限"} — {timeTo || "至今"}　</span> : null}
              {litTypes.length > 0 ? <span>类型：{litTypes.join("、")}　</span> : null}
              {databases.length > 0 ? <span>数据库：{databases.join("、")}　</span> : null}
              <span>引用格式：{citationFormatLabel}</span>
            </div>
          )}
        </Card>
      )}

      {/* ── Results ── */}
      {(agents.length > 0 || structured || content) ? (
        <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left: Agent flow + papers */}
          <div className="space-y-4">
            <Card padding="sm" className="space-y-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-apple-blue" />
                <p className="text-sm font-semibold text-ink-primary">多能力域模型协作流程</p>
              </div>
              {agents.length === 0 ? (
                <p className="text-sm leading-6 text-ink-tertiary">等待能力域模型开始执行任务。</p>
              ) : (
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-2xl p-3"
                      style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 flex-shrink-0 text-ink-tertiary" />
                            <p className="truncate text-sm font-medium text-ink-primary">{toCapabilityModelName(agent.name)}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-ink-tertiary">{replaceAgentWording(agent.role)}</p>
                        </div>
                        <Badge variant={agent.status === "done" ? "success" : agent.status === "failed" ? "danger" : "info"}>
                          {agent.status === "done" ? "已完成" : agent.status === "failed" ? "失败" : "处理中"}
                        </Badge>
                      </div>
                      {(agent.summary || agent.error) && (
                        <p className={`mt-2 text-xs leading-5 ${agent.error ? "text-apple-red" : "text-ink-secondary"}`}>
                          {agent.error || agent.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Meta info */}
            {structured?.meta && (
              <Card padding="sm" className="space-y-1.5">
                <p className="text-xs font-semibold text-ink-secondary">检索配置</p>
                {structured.meta.time_range && structured.meta.time_range !== "不限" && (
                  <p className="text-xs text-ink-tertiary">时间范围：{structured.meta.time_range}</p>
                )}
                {structured.meta.lit_types && structured.meta.lit_types !== "不限" && (
                  <p className="text-xs text-ink-tertiary">文献类型：{structured.meta.lit_types}</p>
                )}
                {structured.meta.databases && structured.meta.databases !== "不限" && (
                  <p className="text-xs text-ink-tertiary">数据库：{structured.meta.databases}</p>
                )}
                <p className="text-xs text-ink-tertiary">
                  引用格式：{CITATION_FORMATS.find((f) => f.value === structured.citation_format)?.label ?? citationFormatLabel}
                </p>
              </Card>
            )}

            {/* Candidate papers */}
            {structured?.papers?.length ? (
              <Card padding="sm" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-primary">候选文献</p>
                  <Badge variant="default">{structured.papers.length} 篇</Badge>
                </div>
                <div className="space-y-2">
                  {structured.papers.map((paper, index) => (
                    <div key={paper.id || `${paper.title}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <ExternalLink
                          href={paper.paper_url}
                          className="text-sm font-medium text-ink-primary hover:text-apple-blue hover:underline"
                        >
                          [{index + 1}] {paper.title}
                        </ExternalLink>
                        <CcfRatingBadge rating={paper.ccf_rating} />
                        <VenueTypeBadge type={paper.ccf_type} />
                      </div>
                      <p className="mt-1 text-xs text-ink-tertiary">
                        {paper.authors || "未知作者"}
                        {paper.year ? ` · ${paper.year}` : ""}
                        {paper.venue ? " · " : ""}
                        {paper.venue ? (
                          <ExternalLink href={paper.venue_url} className="text-xs text-ink-tertiary hover:text-apple-blue hover:underline">
                            {paper.venue}
                          </ExternalLink>
                        ) : null}
                        {paper.ccf_area ? ` · ${paper.ccf_area}` : ""}
                      </p>
                      {paper.doi && (
                        <p className="mt-1 text-[11px] text-ink-tertiary">
                          DOI:{" "}
                          <ExternalLink href={`https://doi.org/${paper.doi}`} className="hover:text-apple-blue hover:underline">
                            {paper.doi}
                          </ExternalLink>
                        </p>
                      )}
                      {paper.abstract && (
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink-secondary">{paper.abstract}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          {/* Right: Structured report */}
          <div className="space-y-4">
            {structured && (
              <Card padding="sm" className="space-y-5">
                <div>
                  <p className="text-lg font-semibold text-ink-primary">结构化综述</p>
                  <p className="mt-1 text-xs text-ink-tertiary">研究问题：{structured.query}</p>
                </div>

                {/* Background */}
                {structured.report.background && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究背景</p>
                    <p className="text-sm leading-relaxed text-ink-secondary">{structured.report.background}</p>
                  </div>
                )}

                {/* Development Timeline */}
                {structured.report.development_timeline && structured.report.development_timeline.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">发展脉络</p>
                    {structured.report.earliest_period && (
                      <p className="mb-2 text-xs text-ink-tertiary italic">{structured.report.earliest_period}</p>
                    )}
                    <div className="space-y-2">
                      {structured.report.development_timeline.map((stage, index) => (
                        <div key={`${stage.period}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                          <p className="text-sm font-semibold text-apple-blue">{stage.period}</p>
                          <p className="mt-1 text-sm text-ink-primary">{stage.milestone}</p>
                          {stage.key_works && stage.key_works.length > 0 && (
                            <p className="mt-1.5 text-[11px] text-ink-tertiary">
                              代表工作：{stage.key_works.map((title, i) => (
                                <span key={`${title}-${i}`}>
                                  {i > 0 ? "；" : ""}
                                  <ExternalLink
                                    href={buildPaperSearchUrl(title)}
                                    className="text-[11px] text-ink-tertiary hover:text-apple-blue hover:underline"
                                  >
                                    {title}
                                  </ExternalLink>
                                </span>
                              ))}
                            </p>
                          )}
                          {stage.significance && (
                            <p className="mt-1 text-[11px] text-ink-tertiary">{stage.significance}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {structured.report.current_frontier && (
                      <p className="mt-2 rounded-xl border border-apple-blue/20 bg-apple-blue/5 px-3 py-2 text-xs text-apple-blue">
                        当前前沿：{structured.report.current_frontier}
                      </p>
                    )}
                  </div>
                )}

                {/* Major Methods */}
                {structured.report.major_methods && structured.report.major_methods.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">主要方法</p>
                    <div className="space-y-2">
                      {structured.report.major_methods.map((method, index) => (
                        <div key={`${method.name}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                          <p className="text-sm font-medium text-ink-primary">{method.name || `方法 ${index + 1}`}</p>
                          {method.description && <p className="mt-1 text-xs leading-5 text-ink-secondary">{method.description}</p>}
                          {(method.pros || method.cons) && (
                            <p className="mt-2 text-[11px] text-ink-tertiary">
                              优势：{method.pros || "-"}；局限：{method.cons || "-"}
                            </p>
                          )}
                          {method.representative_papers && method.representative_papers.length > 0 && (
                            <p className="mt-2 text-[11px] text-ink-tertiary">
                              代表论文：{method.representative_papers.map((title, i) => (
                                <span key={`${title}-${i}`}>
                                  {i > 0 ? "；" : ""}
                                  <ExternalLink
                                    href={buildPaperSearchUrl(title)}
                                    className="text-[11px] text-ink-tertiary hover:text-apple-blue hover:underline"
                                  >
                                    {title}
                                  </ExternalLink>
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schools of Thought */}
                {structured.report.schools_of_thought && structured.report.schools_of_thought.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">主要学派与流派</p>
                    <div className="space-y-2">
                      {structured.report.schools_of_thought.map((school, index) => (
                        <div key={`${school.name}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                          <p className="text-sm font-medium text-ink-primary">{school.name}</p>
                          {school.description && <p className="mt-1 text-xs leading-5 text-ink-secondary">{school.description}</p>}
                          {school.representatives && school.representatives.length > 0 && (
                            <p className="mt-1.5 text-[11px] text-ink-tertiary">代表：{school.representatives.join("、")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Methodology Summary */}
                {structured.report.methodology_summary && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究方法总结</p>
                    <div className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3 space-y-1.5">
                      {structured.report.methodology_summary.mainstream && (
                        <p className="text-xs text-ink-secondary"><span className="font-medium text-ink-primary">主流：</span>{structured.report.methodology_summary.mainstream}</p>
                      )}
                      {structured.report.methodology_summary.emerging && (
                        <p className="text-xs text-ink-secondary"><span className="font-medium text-ink-primary">新兴：</span>{structured.report.methodology_summary.emerging}</p>
                      )}
                      {structured.report.methodology_summary.comparison && (
                        <p className="text-xs text-ink-secondary"><span className="font-medium text-ink-primary">对比：</span>{structured.report.methodology_summary.comparison}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Research Trends */}
                {structured.report.research_trends && structured.report.research_trends.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究趋势</p>
                    <div className="space-y-2">
                      {structured.report.research_trends.map((trend, index) => (
                        <div key={`${trend.trend}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                          <p className="text-sm font-medium text-ink-primary">{trend.trend}</p>
                          <p className="mt-1 text-xs leading-5 text-ink-secondary">{trend.signal}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controversies */}
                {structured.report.controversies && structured.report.controversies.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究争议</p>
                    <div className="space-y-2">
                      {structured.report.controversies.map((c, index) => (
                        <div key={`${c.topic}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                          <p className="text-sm font-medium text-ink-primary">{c.topic}</p>
                          {c.positions && c.positions.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 pl-3">
                              {c.positions.map((pos, pi) => (
                                <li key={pi} className="list-disc text-xs leading-5 text-ink-secondary">{pos}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Challenges */}
                {structured.report.challenges && structured.report.challenges.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">关键挑战</p>
                    <ul className="space-y-1.5 pl-4 text-sm leading-6 text-ink-secondary">
                      {structured.report.challenges.map((challenge, index) => (
                        <li key={`${challenge}-${index}`} className="list-disc">{challenge}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Research Gaps */}
                {structured.report.research_gaps && structured.report.research_gaps.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究缺口</p>
                    <div className="space-y-1.5">
                      {structured.report.research_gaps.map((gap, index) => (
                        <div key={`${gap}-${index}`} className="flex items-start gap-2 rounded-xl border border-apple-orange/20 bg-apple-orange/5 px-3 py-2">
                          <span className="mt-0.5 flex-shrink-0 rounded-full bg-apple-orange/20 px-1.5 text-[10px] font-bold text-apple-orange">{index + 1}</span>
                          <p className="text-xs leading-5 text-ink-secondary">{gap}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Future Directions */}
                {structured.report.future_directions && structured.report.future_directions.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">未来研究主题</p>
                    <ul className="space-y-1.5 pl-4 text-sm leading-6 text-ink-secondary">
                      {structured.report.future_directions.map((dir, index) => (
                        <li key={`${dir}-${index}`} className="list-disc">{dir}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Topics */}
                {structured.report.recommended_topics && structured.report.recommended_topics.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">建议研究主题</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {structured.report.recommended_topics.map((topic, index) => (
                        <div key={`${topic.topic}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                          <p className="text-sm font-medium text-ink-primary">{topic.topic}</p>
                          {topic.why && <p className="mt-1 text-xs leading-5 text-ink-secondary">{topic.why}</p>}
                          {topic.first_step && <p className="mt-2 text-[11px] text-ink-tertiary">第一步：{topic.first_step}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overall Summary */}
                {structured.report.overall_summary && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">总结建议</p>
                    <p className="text-sm leading-relaxed text-ink-secondary">{structured.report.overall_summary}</p>
                  </div>
                )}

                {/* Formatted Citations */}
                {structured.formatted_citations && structured.formatted_citations.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                      参考文献（{CITATION_FORMATS.find((f) => f.value === structured.citation_format)?.label ?? citationFormatLabel} 格式）
                    </p>
                    <div className="rounded-2xl border border-nm-dark/10 bg-white/30 p-3 space-y-1.5">
                      {structured.formatted_citations.map((cite) => (
                        <p key={cite} className="text-[11px] leading-5 text-ink-secondary">{cite}</p>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {content && (
              <Card padding="sm">
                <MarkdownRenderer content={content} onLinkClick={openLink} />
                {generating && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-tertiary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    生成中…
                  </div>
                )}
              </Card>
            )}

            {!content && !structured && generating && (
              <Card className="flex flex-col items-center gap-3 py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
                <p className="text-sm text-ink-tertiary">正在检索文献并生成综述…</p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          >
            <FileSearch className="h-7 w-7 text-ink-tertiary" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">请先输入研究问题</p>
            <p className="mt-1 text-sm text-ink-tertiary">可展开「生成参数」指定时间范围、文献类型与引用格式。</p>
          </div>
        </Card>
      )}
    </div>
  );

  return generationArea;
}
