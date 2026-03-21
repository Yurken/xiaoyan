import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Search, Loader2, AlertCircle, Plus, ChevronDown, ChevronUp,
  FileSearch, StickyNote, Sparkles, X, Trash2, GitBranch, Bot,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Button, Card, Badge, MarkdownRenderer } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { ResearchInterest, KnowledgeNote, LearningPath } from "@research-copilot/types";

type Tab = "interests" | "survey" | "notes";

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
  }>;
}

interface InterestAgentState {
  id: string;
  name: string;
  role: string;
  status: "running" | "done" | "failed";
  summary?: string;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "planned") return <Badge variant="success">已规划</Badge>;
  if (status === "planning") return <Badge variant="info">生成中</Badge>;
  return <Badge variant="default">待规划</Badge>;
}

// ── Learning Path View ────────────────────────────────────────────

function LearningPathView({ lp }: { lp: LearningPath }) {
  return (
    <div className="space-y-4 text-xs text-ink-secondary">
      {lp.overview && (
        <p className="text-sm text-ink-primary leading-relaxed">{lp.overview}</p>
      )}

      {lp.learning_stages && lp.learning_stages.length > 0 && (
        <div>
          <p className="font-semibold text-ink-primary mb-2 text-[11px] uppercase tracking-wide text-ink-tertiary">学习阶段</p>
          <div className="space-y-2">
            {lp.learning_stages.map((s) => (
              <div key={s.stage} className="pl-3 border-l-2 border-apple-blue/40">
                <p className="font-semibold text-ink-primary">{s.stage}. {s.title} <span className="text-ink-tertiary font-normal">({s.duration})</span></p>
                {s.goals.length > 0 && (
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    {s.goals.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {lp.classic_papers && lp.classic_papers.length > 0 && (
        <div>
          <p className="font-semibold text-[11px] uppercase tracking-wide text-ink-tertiary mb-2">经典论文</p>
          <div className="space-y-1.5">
            {lp.classic_papers.map((p, i) => (
              <div key={i}>
                <p className="font-medium text-ink-primary">{p.title} ({p.year})</p>
                <p className="text-ink-tertiary">{p.authors} — {p.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lp.research_directions && lp.research_directions.length > 0 && (
        <div>
          <p className="font-semibold text-[11px] uppercase tracking-wide text-ink-tertiary mb-2">研究方向</p>
          <div className="space-y-1.5">
            {lp.research_directions.map((d, i) => (
              <div key={i}>
                <p className="font-medium text-ink-primary">{d.direction}</p>
                <p>{d.description}</p>
                {d.open_problems.length > 0 && (
                  <p className="text-ink-tertiary">开放问题：{d.open_problems.join("、")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {lp.tools_and_frameworks && lp.tools_and_frameworks.length > 0 && (
        <div>
          <p className="font-semibold text-[11px] uppercase tracking-wide text-ink-tertiary mb-1">工具与框架</p>
          <div className="flex flex-wrap gap-1">
            {lp.tools_and_frameworks.map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue text-[11px]">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: 研究方向 ─────────────────────────────────────────────────

function InterestsTab() {
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [agentsByInterest, setAgentsByInterest] = useState<Record<string, InterestAgentState[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState("");
  const [keywordsRaw, setKeywordsRaw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.knowledge.listInterests()
      .then((d) => { if (!cancelled) { setInterests(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(formatErrorMessage(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Listen for plan events
  useEffect(() => {
    const unsub1 = listen<{ id: string; learning_path: LearningPath }>("interest:plan", (e) => {
      setInterests((prev) =>
        prev.map((r) => r.id === e.payload.id
          ? { ...r, status: "planned", learning_path: e.payload.learning_path }
          : r)
      );
    });
    const unsub2 = listen<{ id: string; error: string }>("interest:error", (e) => {
      setInterests((prev) =>
        prev.map((r) => r.id === e.payload.id ? { ...r, status: "active" } : r)
      );
    });
    const upsertAgent = (interestId: string, next: InterestAgentState) => {
      setAgentsByInterest((prev) => {
        const list = prev[interestId] || [];
        const idx = list.findIndex((a) => a.id === next.id);
        if (idx === -1) {
          return { ...prev, [interestId]: [...list, next] };
        }
        return {
          ...prev,
          [interestId]: list.map((a) => (a.id === next.id ? { ...a, ...next } : a)),
        };
      });
    };
    const unsub3 = listen<{ id: string; agent: InterestAgentState }>("interest:agent_start", (e) => {
      upsertAgent(e.payload.id, e.payload.agent);
    });
    const unsub4 = listen<{ id: string; agent: InterestAgentState }>("interest:agent_complete", (e) => {
      upsertAgent(e.payload.id, { ...e.payload.agent, status: "done" });
    });
    const unsub5 = listen<{ id: string; agent: InterestAgentState }>("interest:agent_error", (e) => {
      upsertAgent(e.payload.id, { ...e.payload.agent, status: "failed" });
    });
    return () => {
      void unsub1.then((fn) => fn());
      void unsub2.then((fn) => fn());
      void unsub3.then((fn) => fn());
      void unsub4.then((fn) => fn());
      void unsub5.then((fn) => fn());
    };
  }, []);

  const handleCreate = async () => {
    if (!topic.trim()) return;
    setSaving(true);
    try {
      const keywords = keywordsRaw.split(/[,，\s]+/).map((k) => k.trim()).filter(Boolean);
      const interest = await apiClient.knowledge.createInterest(topic.trim(), keywords);
      setInterests((prev) => [interest, ...prev]);
      setTopic("");
      setKeywordsRaw("");
      setCreating(false);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePlan = async (id: string) => {
    setInterests((prev) => prev.map((r) => r.id === id ? { ...r, status: "planning" } : r));
    setAgentsByInterest((prev) => ({ ...prev, [id]: [] }));
    try {
      await apiClient.knowledge.generatePlan(id);
    } catch (e) {
      setInterests((prev) => prev.map((r) => r.id === id ? { ...r, status: "active" } : r));
      setError(formatErrorMessage(e));
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-7 h-7 text-apple-blue animate-spin" />
      <p className="text-sm text-ink-tertiary">加载中…</p>
    </div>
  );

  if (error) return (
    <Card className="flex flex-col items-center py-16 text-center gap-3">
      <AlertCircle className="w-8 h-8 text-apple-red" />
      <p className="text-sm text-apple-red break-all">{error}</p>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(!creating)}>
          <Plus className="w-4 h-4" />
          添加研究方向
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <Card padding="sm" className="space-y-3">
          <p className="text-sm font-semibold text-ink-primary">新建研究方向</p>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="研究主题，如「大语言模型对齐」"
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0"
            style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
          />
          <input
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
            placeholder="关键词（逗号分隔），如「RLHF, PPO, reward model」"
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0"
            style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" onClick={() => setCreating(false)}>取消</Button>
            <Button size="sm" loading={saving} onClick={() => void handleCreate()}>创建</Button>
          </div>
        </Card>
      )}

      {/* List */}
      {interests.length === 0 ? (
        <Card className="flex flex-col items-center py-16 text-center gap-3">
          <div
            className="w-14 h-14 rounded-3xl flex items-center justify-center"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <Sparkles className="w-7 h-7 text-ink-tertiary" />
          </div>
          <div>
            <p className="text-ink-secondary font-medium">暂无研究方向</p>
            <p className="text-sm text-ink-tertiary mt-1">添加研究方向，AI 为你生成系统学习路线</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {interests.map((r) => (
            <Card key={r.id} padding="sm" className="space-y-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink-primary">{r.topic}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.keywords && r.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.keywords.map((kw, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue text-[11px]">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {r.status !== "planning" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleGeneratePlan(r.id)}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {r.status === "planned" ? "重新规划" : "生成路线"}
                    </Button>
                  )}
                  {r.status === "planning" && (
                    <span className="flex items-center gap-1 text-xs text-apple-blue">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中…
                    </span>
                  )}
                  {r.learning_path && (
                    <button
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary transition-colors"
                      style={{ background: "#E8ECF0", boxShadow: "2px 2px 5px #C8CDD3, -2px -2px 5px #FFFFFF" }}
                    >
                      {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {(agentsByInterest[r.id]?.length || 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-nm-dark/10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <GitBranch className="w-3.5 h-3.5 text-apple-blue" />
                    <p className="text-xs font-semibold text-ink-primary">规划 Agent 协作（白盒）</p>
                  </div>
                  <div className="space-y-2">
                    {(agentsByInterest[r.id] || []).map((agent) => (
                      <div
                        key={agent.id}
                        className="rounded-xl p-2.5"
                        style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-primary truncate">{agent.name}</p>
                            <p className="text-[11px] text-ink-tertiary truncate">{agent.role}</p>
                          </div>
                          <Badge variant={agent.status === "done" ? "success" : agent.status === "failed" ? "danger" : "info"}>
                            {agent.status === "done" ? "完成" : agent.status === "failed" ? "失败" : "运行中"}
                          </Badge>
                        </div>
                        {(agent.summary || agent.error) && (
                          <p className={`text-[11px] mt-1.5 ${agent.error ? "text-apple-red" : "text-ink-secondary"}`}>
                            {agent.error || agent.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expanded === r.id && r.learning_path && (
                <div className="mt-3 pt-3 border-t border-nm-dark/10">
                  <LearningPathView lp={r.learning_path} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: 文献综述 ─────────────────────────────────────────────────

function SurveyTab() {
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
    return () => { unlistenersRef.current.forEach((fn) => fn()); };
  }, []);

  const handleGenerate = async () => {
    if (!query.trim() || generating) return;
    // Cleanup old listeners
    unlistenersRef.current.forEach((fn) => fn());
    unlistenersRef.current = [];
    contentRef.current = "";
    requestIdRef.current = null;
    setContent("");
    setAgents([]);
    setStructured(null);
    setError("");
    setGenerating(true);

    const [u1, u2, u3, u4, u5] = await Promise.all([
      listen<{ request_id?: string; delta: string }>("survey:delta", (e) => {
        if (!acceptRequest(e.payload.request_id)) return;
        contentRef.current += e.payload.delta;
        setContent(contentRef.current);
      }),
      listen<{ request_id?: string }>("survey:done", (e) => {
        if (!acceptRequest(e.payload.request_id)) return;
        setGenerating(false);
      }),
      listen<{ request_id?: string; error: string }>("survey:error", (e) => {
        if (!acceptRequest(e.payload.request_id)) return;
        setError(e.payload.error);
        setGenerating(false);
      }),
      listen<{ request_id?: string; query: string; report: StructuredSurveyResult["report"]; papers: StructuredSurveyResult["papers"] }>("survey:structured", (e) => {
        if (!acceptRequest(e.payload.request_id)) return;
        setStructured({
          query: e.payload.query,
          report: e.payload.report,
          papers: e.payload.papers,
        });
      }),
      listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_start", (e) => {
        if (!acceptRequest(e.payload.request_id)) return;
        const next = e.payload.agent;
        setAgents((prev) => {
          const exists = prev.some((a) => a.id === next.id);
          if (exists) return prev.map((a) => (a.id === next.id ? { ...a, ...next } : a));
          return [...prev, next];
        });
      }),
    ]);

    const [u6, u7] = await Promise.all([
      listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_complete", (e) => {
        if (!acceptRequest(e.payload.request_id)) return;
        const next = e.payload.agent;
        setAgents((prev) => prev.map((a) => (a.id === next.id ? { ...a, ...next, status: "done" } : a)));
      }),
      listen<{ request_id?: string; agent: SurveyAgentState }>("survey:agent_error", (e) => {
        if (!acceptRequest(e.payload.request_id)) return;
        const next = e.payload.agent;
        setAgents((prev) => prev.map((a) => (a.id === next.id ? { ...a, ...next, status: "failed" } : a)));
        setError(next.error || "生成失败，请重试");
        setGenerating(false);
      }),
    ]);

    unlistenersRef.current = [u1, u2, u3, u4, u5, u6, u7];

    try {
      await apiClient.survey.generate(query.trim());
    } catch (e) {
      setError(formatErrorMessage(e));
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleGenerate(); }}
          placeholder="输入研究问题，如「Transformer attention 机制的发展」"
          className="flex-1 rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0"
          style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
          disabled={generating}
        />
        <Button onClick={() => void handleGenerate()} loading={generating} disabled={!query.trim()}>
          <FileSearch className="w-4 h-4" />
          生成综述
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card padding="sm" className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-apple-red flex-shrink-0" />
          <p className="text-sm text-apple-red">{error}</p>
        </Card>
      )}

      {/* Result */}
      {(agents.length > 0 || structured || content) ? (
        <div className="space-y-4">
          {agents.length > 0 && (
            <Card padding="sm" className="space-y-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-apple-blue" />
                <p className="text-sm font-semibold text-ink-primary">多 Agent 协作流程</p>
              </div>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-2xl p-3"
                    style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Bot className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-primary truncate">{agent.name}</p>
                          <p className="text-xs text-ink-tertiary truncate">{agent.role}</p>
                        </div>
                      </div>
                      <Badge
                        variant={agent.status === "done" ? "success" : agent.status === "failed" ? "danger" : "info"}
                      >
                        {agent.status === "done" ? "完成" : agent.status === "failed" ? "失败" : "运行中"}
                      </Badge>
                    </div>
                    {(agent.summary || agent.error) && (
                      <p className={`text-xs mt-2 ${agent.error ? "text-apple-red" : "text-ink-secondary"}`}>
                        {agent.error || agent.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {structured && (
            <Card padding="sm" className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-ink-primary">结构化文献综述</p>
                <p className="text-xs text-ink-tertiary mt-1">研究问题：{structured.query}</p>
              </div>

              {structured.report.background && (
                <div>
                  <p className="text-xs font-semibold text-ink-tertiary uppercase tracking-wide mb-1">研究背景</p>
                  <p className="text-sm text-ink-secondary leading-relaxed">{structured.report.background}</p>
                </div>
              )}

              {structured.report.major_methods && structured.report.major_methods.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-tertiary uppercase tracking-wide mb-2">主要方法</p>
                  <div className="space-y-2">
                    {structured.report.major_methods.map((m, i) => (
                      <div key={i} className="rounded-xl p-3 border border-nm-dark/10">
                        <p className="text-sm font-medium text-ink-primary">{m.name || `方法 ${i + 1}`}</p>
                        {m.description && <p className="text-xs text-ink-secondary mt-1">{m.description}</p>}
                        {(m.pros || m.cons) && (
                          <p className="text-xs text-ink-tertiary mt-1.5">优势：{m.pros || "-"}；局限：{m.cons || "-"}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {structured.report.research_trends && structured.report.research_trends.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-tertiary uppercase tracking-wide mb-2">研究趋势</p>
                  <ul className="space-y-1.5">
                    {structured.report.research_trends.map((t, i) => (
                      <li key={i} className="text-sm text-ink-secondary">• {t.trend}：{t.signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {structured.report.recommended_topics && structured.report.recommended_topics.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-tertiary uppercase tracking-wide mb-2">建议研究主题</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {structured.report.recommended_topics.map((t, i) => (
                      <div key={i} className="rounded-xl p-3 border border-nm-dark/10">
                        <p className="text-sm font-medium text-ink-primary">{t.topic}</p>
                        {t.why && <p className="text-xs text-ink-secondary mt-1">{t.why}</p>}
                        {t.first_step && <p className="text-xs text-ink-tertiary mt-1">第一步：{t.first_step}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {structured.papers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-tertiary uppercase tracking-wide mb-2">
                    自动检索文献（{structured.papers.length}）
                  </p>
                  <div className="space-y-2">
                    {structured.papers.map((p, i) => (
                      <div key={p.id || String(i)} className="rounded-xl p-3 border border-nm-dark/10">
                        <p className="text-sm font-medium text-ink-primary">[{i + 1}] {p.title}</p>
                        <p className="text-xs text-ink-tertiary mt-1">
                          {p.authors || "未知作者"}
                          {p.year ? ` · ${p.year}` : ""}
                          {p.venue ? ` · ${p.venue}` : ""}
                        </p>
                        {p.abstract && <p className="text-xs text-ink-secondary mt-1 line-clamp-2">{p.abstract}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {content && (
            <Card padding="sm">
              <MarkdownRenderer content={content} />
              {generating && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-ink-tertiary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中…
                </div>
              )}
            </Card>
          )}
        </div>
      ) : !generating ? (
        <Card className="flex flex-col items-center py-16 text-center gap-3">
          <div
            className="w-14 h-14 rounded-3xl flex items-center justify-center"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <FileSearch className="w-7 h-7 text-ink-tertiary" />
          </div>
          <div>
            <p className="text-ink-secondary font-medium">输入研究问题</p>
            <p className="text-sm text-ink-tertiary mt-1">AI 将检索知识库并生成综述报告</p>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center py-16 text-center gap-3">
          <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
          <p className="text-sm text-ink-tertiary">正在检索与生成综述…</p>
        </Card>
      )}
    </div>
  );
}

// ── Tab: 知识笔记 ─────────────────────────────────────────────────

function NotesTab() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.knowledge.listNotes(search || undefined)
      .then((d) => { if (!cancelled) { setNotes(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(formatErrorMessage(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [search]);

  const handleCreateNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    setSaving(true);
    try {
      const note = await apiClient.knowledge.createNote({ title: noteTitle.trim(), content: noteContent.trim() });
      setNotes((prev) => [note, ...prev]);
      setNoteTitle("");
      setNoteContent("");
      setCreating(false);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.knowledge.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索笔记…"
            className="w-full rounded-2xl pl-10 pr-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0"
            style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
          />
        </div>
        <Button size="sm" onClick={() => setCreating(!creating)}>
          <Plus className="w-4 h-4" />
          新建笔记
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <Card padding="sm" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-primary">新建笔记</p>
            <button onClick={() => setCreating(false)} className="text-ink-tertiary hover:text-ink-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="标题"
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0"
            style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
          />
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="笔记内容…"
            rows={4}
            className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 resize-none"
            style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" onClick={() => setCreating(false)}>取消</Button>
            <Button size="sm" loading={saving} onClick={() => void handleCreateNote()}>保存</Button>
          </div>
        </Card>
      )}

      {error && (
        <Card padding="sm" className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-apple-red flex-shrink-0" />
          <p className="text-sm text-apple-red">{error}</p>
        </Card>
      )}

      {/* Notes grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-apple-blue animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <Card className="flex flex-col items-center py-16 text-center gap-3">
          <div
            className="w-14 h-14 rounded-3xl flex items-center justify-center"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <StickyNote className="w-7 h-7 text-ink-tertiary" />
          </div>
          <div>
            <p className="text-ink-secondary font-medium">{search ? "未找到相关笔记" : "暂无笔记"}</p>
            <p className="text-sm text-ink-tertiary mt-1">
              {search ? "换个关键词试试" : "分析论文后自动生成，或手动新建笔记"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <Card key={n.id} padding="sm" className="flex flex-col gap-2 group relative">
              <p className="text-sm font-semibold text-ink-primary line-clamp-1 pr-6">{n.title}</p>
              <p className="text-xs text-ink-secondary leading-relaxed line-clamp-4">{n.content}</p>
              {n.tags && n.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {n.tags.map((t, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue text-[11px]">{t}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-ink-tertiary mt-auto pt-1">
                {new Date(n.created_at).toLocaleDateString("zh-CN")}
              </p>
              <button
                onClick={() => void handleDelete(n.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-ink-tertiary hover:text-apple-red"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function Knowledge() {
  const [tab, setTab] = useState<Tab>("interests");

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "interests", label: "研究方向", icon: <Sparkles className="w-4 h-4" /> },
    { key: "survey",    label: "文献综述", icon: <FileSearch className="w-4 h-4" /> },
    { key: "notes",     label: "知识笔记", icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">知识库</h1>
        <p className="text-sm text-ink-tertiary mt-0.5">管理研究方向、生成综述、沉淀笔记</p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl"
        style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
              tab === t.key
                ? "text-ink-primary"
                : "text-ink-tertiary hover:text-ink-secondary"
            }`}
            style={
              tab === t.key
                ? { background: "#E8ECF0", boxShadow: "3px 3px 7px #C0C5CB, -3px -3px 7px #FFFFFF" }
                : {}
            }
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "interests" && <InterestsTab />}
      {tab === "survey"    && <SurveyTab />}
      {tab === "notes"     && <NotesTab />}
    </div>
  );
}
