import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, FileSearch, GitBranch, Loader2 } from "lucide-react";
import { Badge, Button, Card, Input, MarkdownRenderer } from "@research-copilot/ui";
import { CcfRatingBadge, VenueTypeBadge } from "../../components/CcfBadges";
import ExternalLink from "../../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { buildPaperSearchUrl, openLink } from "../../lib/links";
import { listen } from "@tauri-apps/api/event";
import type { ResearchInterest } from "@research-copilot/types";

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
    major_methods?: Array<{
      name?: string;
      description?: string;
      representative_papers?: string[];
      pros?: string;
      cons?: string;
    }>;
    research_trends?: Array<{ trend?: string; signal?: string }>;
    challenges?: string[];
    recommended_topics?: Array<{ topic?: string; why?: string; first_step?: string }>;
    overall_summary?: string;
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
}

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

export default function SurveyPanel() {
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [query, setQuery] = useState("");
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

    apiClient.knowledge
      .listInterests()
      .then((data) => {
        if (!cancelled) {
          setInterests(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInterests([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      unlistenersRef.current.forEach((cleanup) => cleanup());
    };
  }, []);

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
      }>("survey:structured", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        setStructured({
          query: event.payload.query,
          report: event.payload.report,
          papers: event.payload.papers,
        });
      }),
      listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_start", (event) => {
        if (!acceptRequest(event.payload.request_id)) return;
        const nextAgent = event.payload.agent;
        setAgents((prev) => {
          const exists = prev.some((item) => item.id === nextAgent.id);
          if (exists) {
            return prev.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent } : item));
          }
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
        setError(nextAgent.error || "生成失败，请重试");
        setGenerating(false);
      }),
    ]);

    unlistenersRef.current = [
      unlistenDelta,
      unlistenDone,
      unlistenError,
      unlistenStructured,
      unlistenAgentStart,
      unlistenAgentComplete,
      unlistenAgentError,
    ];

    try {
      await apiClient.survey.generate(query.trim());
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card padding="sm" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">结构化文献综述生成</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              自动规划检索范围、检索候选论文，并输出结构化综述与可切入研究主题。
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-[520px] lg:flex-row">
            <div className="flex-1">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleGenerate();
                  }
                }}
                placeholder="输入研究问题，如 Transformer attention 机制的发展"
                disabled={generating}
              />
            </div>
            <Button onClick={() => void handleGenerate()} loading={generating} disabled={!query.trim()}>
              <FileSearch className="h-4 w-4" />
              生成综述
            </Button>
          </div>
        </div>

        {interests.length > 0 && (
          <div className="rounded-2xl border border-nm-dark/10 bg-white/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">主题分组</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedInterestId("")}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  selectedInterestId ? "bg-white/55 text-ink-secondary hover:text-ink-primary" : "bg-apple-blue/10 text-apple-blue"
                }`}
              >
                自由检索
              </button>
              {interests.map((interest) => (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => {
                    setSelectedInterestId(interest.id);
                    setQuery(interest.topic);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    selectedInterestId === interest.id
                      ? "bg-apple-blue/10 text-apple-blue"
                      : "bg-white/55 text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {interestFolderName(interest)}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {(agents.length > 0 || structured || content) ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card padding="sm" className="space-y-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-apple-blue" />
                <p className="text-sm font-semibold text-ink-primary">多 Agent 协作流程</p>
              </div>

              {agents.length === 0 ? (
                <p className="text-sm leading-6 text-ink-tertiary">等待 planner 和 retriever 开始执行。</p>
              ) : (
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-2xl p-3"
                      style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 flex-shrink-0 text-ink-tertiary" />
                            <p className="truncate text-sm font-medium text-ink-primary">{agent.name}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-ink-tertiary">{agent.role}</p>
                        </div>
                        <Badge variant={agent.status === "done" ? "success" : agent.status === "failed" ? "danger" : "info"}>
                          {agent.status === "done" ? "完成" : agent.status === "failed" ? "失败" : "运行中"}
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

            {structured?.papers?.length ? (
              <Card padding="sm" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-primary">候选文献</p>
                  <Badge variant="default">{structured.papers.length} 篇</Badge>
                </div>
                <div className="space-y-2">
                  {structured.papers.slice(0, 6).map((paper, index) => (
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
                          <ExternalLink
                            href={paper.venue_url}
                            className="text-xs text-ink-tertiary hover:text-apple-blue hover:underline"
                          >
                            {paper.venue}
                          </ExternalLink>
                        ) : null}
                        {paper.ccf_area ? ` · ${paper.ccf_area}` : ""}
                      </p>
                      {paper.abstract && (
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink-secondary">{paper.abstract}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            {structured && (
              <Card padding="sm" className="space-y-5">
                <div>
                  <p className="text-lg font-semibold text-ink-primary">结构化综述</p>
                  <p className="mt-1 text-xs text-ink-tertiary">研究问题：{structured.query}</p>
                </div>

                {structured.report.background && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究背景</p>
                    <p className="text-sm leading-relaxed text-ink-secondary">{structured.report.background}</p>
                  </div>
                )}

                {structured.report.major_methods && structured.report.major_methods.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">主要方法</p>
                    <div className="space-y-2">
                      {structured.report.major_methods.map((method, index) => (
                        <div key={`${method.name}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                          <p className="text-sm font-medium text-ink-primary">{method.name || `方法 ${index + 1}`}</p>
                          {method.description && (
                            <p className="mt-1 text-xs leading-5 text-ink-secondary">{method.description}</p>
                          )}
                          {(method.pros || method.cons) && (
                            <p className="mt-2 text-[11px] text-ink-tertiary">
                              优势：{method.pros || "-"}；局限：{method.cons || "-"}
                            </p>
                          )}
                          {method.representative_papers && method.representative_papers.length > 0 && (
                            <p className="mt-2 text-[11px] text-ink-tertiary">
                              代表论文：
                              {" "}
                              {method.representative_papers.map((title, titleIndex) => (
                                <span key={`${title}-${titleIndex}`}>
                                  {titleIndex > 0 ? " · " : ""}
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

                {structured.report.overall_summary && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">总结建议</p>
                    <p className="text-sm leading-relaxed text-ink-secondary">{structured.report.overall_summary}</p>
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
                <p className="text-sm text-ink-tertiary">正在检索与生成综述…</p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <FileSearch className="h-7 w-7 text-ink-tertiary" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">输入研究问题</p>
            <p className="mt-1 text-sm text-ink-tertiary">系统会自动规划检索范围，并生成结构化综述。</p>
          </div>
        </Card>
      )}
    </div>
  );
}
