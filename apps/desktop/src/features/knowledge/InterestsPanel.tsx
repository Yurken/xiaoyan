import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, GitBranch, Loader2, Plus, Sparkles } from "lucide-react";
import { Badge, Button, Card } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { LearningPath, ResearchInterest } from "@research-copilot/types";
import { listen } from "@tauri-apps/api/event";
import PlannerComposer from "./PlannerComposer";
import ResearchWorkbench from "./ResearchWorkbench";

interface InterestAgentState {
  id: string;
  name: string;
  role: string;
  status: "running" | "done" | "failed";
  summary?: string;
  error?: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "planned") return <Badge variant="success">已规划</Badge>;
  if (status === "planning") return <Badge variant="info">生成中</Badge>;
  return <Badge variant="default">待规划</Badge>;
}

function LearningPathView({ path }: { path: LearningPath }) {
  return (
    <div className="space-y-5 text-xs text-ink-secondary">
      {path.overview && (
        <p className="text-sm leading-relaxed text-ink-primary">{path.overview}</p>
      )}

      {path.prerequisites && path.prerequisites.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">前置知识</p>
          <div className="grid gap-2 md:grid-cols-2">
            {path.prerequisites.map((item) => (
              <div key={item.name} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-semibold text-ink-primary">{item.name}</p>
                <p className="mt-1 leading-5">{item.description}</p>
                {item.resources.length > 0 && (
                  <p className="mt-2 text-[11px] text-ink-tertiary">推荐资源：{item.resources.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {path.learning_stages && path.learning_stages.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">学习阶段</p>
          <div className="space-y-3">
            {path.learning_stages.map((stage) => (
              <div key={`${stage.stage}-${stage.title}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">
                      {stage.stage}. {stage.title}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-ink-tertiary">
                      预计时长 · {stage.duration}
                    </p>
                  </div>
                  <Badge variant="info">{stage.topics.length} 个主题</Badge>
                </div>
                {stage.goals.length > 0 && (
                  <ul className="mt-3 space-y-1.5 pl-4 text-xs leading-5 text-ink-secondary">
                    {stage.goals.map((goal, index) => (
                      <li key={`${stage.stage}-goal-${index}`} className="list-disc">
                        {goal}
                      </li>
                    ))}
                  </ul>
                )}
                {stage.resources.length > 0 && (
                  <p className="mt-3 text-[11px] text-ink-tertiary">资源：{stage.resources.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {path.classic_papers && path.classic_papers.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">经典论文</p>
          <div className="space-y-2">
            {path.classic_papers.map((paper, index) => (
              <div key={`${paper.title}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-semibold text-ink-primary">
                  {paper.title} <span className="font-normal text-ink-tertiary">({paper.year})</span>
                </p>
                <p className="mt-1 text-xs text-ink-tertiary">{paper.authors}</p>
                <p className="mt-2 leading-5 text-ink-secondary">{paper.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {path.research_directions && path.research_directions.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究方向</p>
          <div className="grid gap-2 md:grid-cols-2">
            {path.research_directions.map((direction, index) => (
              <div key={`${direction.direction}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
                <p className="text-sm font-semibold text-ink-primary">{direction.direction}</p>
                <p className="mt-1 leading-5 text-ink-secondary">{direction.description}</p>
                {direction.open_problems.length > 0 && (
                  <p className="mt-2 text-[11px] text-ink-tertiary">
                    开放问题：{direction.open_problems.join("、")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(path.tools_and_frameworks?.length || path.communities?.length) ? (
        <div className="grid gap-3 md:grid-cols-2">
          {path.tools_and_frameworks && path.tools_and_frameworks.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">工具与框架</p>
              <div className="flex flex-wrap gap-2">
                {path.tools_and_frameworks.map((tool) => (
                  <span key={tool} className="rounded-full bg-apple-blue/10 px-2 py-1 text-[11px] text-apple-blue">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {path.communities && path.communities.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">社区与会议</p>
              <div className="flex flex-wrap gap-2">
                {path.communities.map((community) => (
                  <span key={community} className="rounded-full bg-white/50 px-2 py-1 text-[11px] text-ink-secondary">
                    {community}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function summarizeProfile(interest: ResearchInterest) {
  const highlights: Array<{ label: string; value: string }> = [];

  if (interest.profile?.goal) {
    highlights.push({ label: "目标", value: interest.profile.goal });
  }
  if (interest.profile?.time_budget) {
    highlights.push({ label: "时间", value: interest.profile.time_budget });
  }
  if (interest.profile?.preferred_output) {
    highlights.push({ label: "输出", value: interest.profile.preferred_output });
  }

  return highlights;
}

export default function InterestsPanel() {
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [agentsByInterest, setAgentsByInterest] = useState<Record<string, InterestAgentState[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient.knowledge.listInterests()
      .then((data) => {
        if (!cancelled) {
          setInterests(data);
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatErrorMessage(nextError));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unlistenPlan = listen<{ id: string; learning_path: LearningPath }>("interest:plan", (event) => {
      setInterests((prev) =>
        prev.map((item) =>
          item.id === event.payload.id
            ? { ...item, status: "planned", learning_path: event.payload.learning_path }
            : item
        )
      );
    });

    const unlistenError = listen<{ id: string; error: string }>("interest:error", (event) => {
      setInterests((prev) =>
        prev.map((item) =>
          item.id === event.payload.id ? { ...item, status: "active" } : item
        )
      );
    });

    const upsertAgent = (interestId: string, nextAgent: InterestAgentState) => {
      setAgentsByInterest((prev) => {
        const current = prev[interestId] || [];
        const index = current.findIndex((item) => item.id === nextAgent.id);
        if (index === -1) {
          return { ...prev, [interestId]: [...current, nextAgent] };
        }

        return {
          ...prev,
          [interestId]: current.map((item) => (item.id === nextAgent.id ? { ...item, ...nextAgent } : item)),
        };
      });
    };

    const unlistenStart = listen<{ id: string; agent: InterestAgentState }>("interest:agent_start", (event) => {
      upsertAgent(event.payload.id, event.payload.agent);
    });

    const unlistenComplete = listen<{ id: string; agent: InterestAgentState }>("interest:agent_complete", (event) => {
      upsertAgent(event.payload.id, { ...event.payload.agent, status: "done" });
    });

    const unlistenAgentError = listen<{ id: string; agent: InterestAgentState }>("interest:agent_error", (event) => {
      upsertAgent(event.payload.id, { ...event.payload.agent, status: "failed" });
    });

    return () => {
      void unlistenPlan.then((cleanup) => cleanup());
      void unlistenError.then((cleanup) => cleanup());
      void unlistenStart.then((cleanup) => cleanup());
      void unlistenComplete.then((cleanup) => cleanup());
      void unlistenAgentError.then((cleanup) => cleanup());
    };
  }, []);

  const handleGeneratePlan = async (id: string) => {
    setInterests((prev) => prev.map((item) => (item.id === id ? { ...item, status: "planning" } : item)));
    setAgentsByInterest((prev) => ({ ...prev, [id]: [] }));

    try {
      await apiClient.knowledge.generatePlan(id);
      setError("");
    } catch (nextError) {
      setInterests((prev) => prev.map((item) => (item.id === id ? { ...item, status: "active" } : item)));
      setError(formatErrorMessage(nextError));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-apple-blue" />
        <p className="text-sm text-ink-tertiary">加载中…</p>
      </div>
    );
  }

  if (error && interests.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-apple-red" />
        <p className="break-all text-sm text-apple-red">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="sm" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">研究路线设计器</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              把研究主题转成阶段化学习路线、经典论文和潜在切入方向。
            </p>
          </div>
          <Button size="sm" onClick={() => setCreating((prev) => !prev)}>
            <Plus className="h-4 w-4" />
            {creating ? "收起表单" : "添加研究方向"}
          </Button>
        </div>

        {creating && (
          <PlannerComposer
            onCancel={() => setCreating(false)}
            onCreated={(nextInterest) => {
              setInterests((prev) => [nextInterest, ...prev]);
              setCreating(false);
              setError("");
            }}
          />
        )}

        {error && interests.length > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </Card>

      {interests.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <Sparkles className="h-7 w-7 text-ink-tertiary" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">暂无研究方向</p>
            <p className="mt-1 text-sm text-ink-tertiary">添加研究方向，AI 会为你生成系统化路线。</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {interests.map((interest) => {
            const profileHighlights = summarizeProfile(interest);
            const agents = agentsByInterest[interest.id] || [];
            const hasRunningAgent = agents.some((agent) => agent.status === "running");

            return (
              <Card key={interest.id} padding="sm" className="space-y-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink-primary">{interest.topic}</p>
                      <StatusBadge status={interest.status} />
                    </div>
                    {interest.keywords && interest.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {interest.keywords.map((keyword) => (
                          <span key={`${interest.id}-${keyword}`} className="rounded-full bg-apple-blue/10 px-2 py-1 text-[11px] text-apple-blue">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}

                    {(profileHighlights.length > 0 || interest.profile?.constraints?.length) && (
                      <div className="mt-3 rounded-2xl border border-nm-dark/10 bg-white/35 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">研究画像</p>

                        {profileHighlights.length > 0 && (
                          <div className="mt-2 grid gap-2 lg:grid-cols-3">
                            {profileHighlights.map((item) => (
                              <div
                                key={`${interest.id}-${item.label}`}
                                className="rounded-2xl border border-white/60 bg-white/55 px-3 py-2"
                              >
                                <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">{item.label}</p>
                                <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {interest.profile?.constraints && interest.profile.constraints.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {interest.profile.constraints.map((constraint) => (
                              <span
                                key={`${interest.id}-${constraint}`}
                                className="rounded-full bg-[#D7EEF8] px-2 py-1 text-[11px] text-[#0A84C1]"
                              >
                                {constraint}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {interest.status !== "planning" ? (
                      <Button size="sm" variant="secondary" onClick={() => void handleGeneratePlan(interest.id)}>
                        <Sparkles className="h-3.5 w-3.5" />
                        {interest.status === "planned" ? "重新规划" : "生成路线"}
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-apple-blue">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        生成中…
                      </span>
                    )}

                    {interest.learning_path && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => (prev === interest.id ? null : interest.id))}
                        className="rounded-xl p-1.5 text-ink-tertiary transition-colors hover:text-ink-primary"
                        style={{ background: "#E8ECF0", boxShadow: "2px 2px 5px #C8CDD3, -2px -2px 5px #FFFFFF" }}
                      >
                        {expanded === interest.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {agents.length > 0 && (
                  <div className="mt-4 border-t border-nm-dark/10 pt-4">
                    <div className="agent-flow-shell">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5 text-apple-blue" />
                            <p className="text-xs font-semibold text-ink-primary">规划 Agent 协作流程</p>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">
                            实时展示主题分析、文献侦察与路线生成的接力状态。
                          </p>
                        </div>
                        <span className="text-[11px] text-ink-tertiary">
                          {hasRunningAgent ? "协作进行中" : "阶段结果已同步"}
                        </span>
                      </div>

                      <div className="agent-flow-track" aria-hidden="true">
                        <span className="agent-flow-track__line" />
                        <span className={`agent-flow-track__signal${hasRunningAgent ? "" : " is-idle"}`} />
                      </div>

                      <div className="agent-flow-grid">
                        {agents.map((agent, index) => (
                          <div key={agent.id} className={`agent-flow-card agent-flow-card--${agent.status}`}>
                            <span
                              className="agent-flow-card__beam"
                              aria-hidden="true"
                              style={{ animationDelay: `${index * 140}ms` }}
                            />
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="agent-flow-card__meta">
                                  <span className="agent-flow-step">{String(index + 1).padStart(2, "0")}</span>
                                  <span className={`agent-flow-dot agent-flow-dot--${agent.status}`} aria-hidden="true" />
                                </div>
                                <p className="mt-3 truncate text-sm font-semibold text-ink-primary">{agent.name}</p>
                                <p className="mt-1 truncate text-[11px] text-ink-tertiary">{agent.role}</p>
                              </div>
                              <Badge variant={agent.status === "done" ? "success" : agent.status === "failed" ? "danger" : "info"}>
                                {agent.status === "done" ? "完成" : agent.status === "failed" ? "失败" : "运行中"}
                              </Badge>
                            </div>

                            <p className={`mt-3 text-[11px] leading-5 ${agent.error ? "text-apple-red" : "text-ink-secondary"}`}>
                              {agent.error || agent.summary || "等待该 Agent 输出阶段性结论。"}
                            </p>

                            <div className="agent-flow-progress" aria-hidden="true">
                              <span
                                className="agent-flow-progress__bar"
                                style={{ animationDelay: `${index * 140}ms` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {expanded === interest.id && interest.learning_path && (
                  <div className="mt-4 border-t border-nm-dark/10 pt-4">
                    <div className="space-y-5">
                      <LearningPathView path={interest.learning_path} />
                      <ResearchWorkbench interest={interest} />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
