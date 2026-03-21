"use client";

import { useRef, useState } from "react";
import {
  BookOpen,
  Sparkles,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  GitBranch,
  Bot,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, Input, Button, Badge } from "@research-copilot/ui";
import { surveyApi } from "@/lib/client";

type AgentStatus = "pending" | "running" | "done" | "failed";

interface AgentStep {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  summary?: string;
  error?: string;
}

interface SurveyPaper {
  id?: string;
  title: string;
  authors: string;
  year: number;
  abstract: string;
  venue: string;
  citation_count: number;
  pdf_url: string;
  doi: string;
}

interface SurveyData {
  query: string;
  background?: string;
  representative_methods: Array<{
    category: string;
    description: string;
    key_papers: number[];
    strengths: string;
    weaknesses: string;
  }>;
  research_trends: Array<{ trend: string; description: string; evidence: string }>;
  existing_gaps?: string[];
  future_directions: Array<{ direction: string; rationale: string }>;
  key_takeaways?: string;
  papers: SurveyPaper[];
}

function getDefaultWorkflow(): AgentStep[] {
  return [
    {
      id: "planner",
      name: "Intent Planner",
      role: "规划研究范围与检索策略",
      status: "pending",
    },
    {
      id: "retriever",
      name: "Literature Retriever",
      role: "自动检索相关文献",
      status: "pending",
    },
    {
      id: "writer",
      name: "Survey Writer",
      role: "生成结构化文献综述",
      status: "pending",
    },
  ];
}

function normalizeSurvey(raw: Record<string, unknown>, userQuery: string): SurveyData {
  const query = (raw.query as string) || userQuery;
  const report = (raw.report ?? {}) as Record<string, unknown>;

  const background =
    (raw.background as string | undefined) ??
    (report.background as string | undefined);

  const methodsFromOld = Array.isArray(raw.representative_methods)
    ? (raw.representative_methods as Array<Record<string, unknown>>).map((m) => ({
        category: String(m.category ?? "未命名方法"),
        description: String(m.description ?? ""),
        key_papers: Array.isArray(m.key_papers)
          ? m.key_papers.map((n) => Number(n)).filter((n) => Number.isFinite(n))
          : [],
        strengths: String(m.strengths ?? ""),
        weaknesses: String(m.weaknesses ?? ""),
      }))
    : [];

  const methodsFromStructured = Array.isArray(report.major_methods)
    ? (report.major_methods as Array<Record<string, unknown>>).map((m, idx) => ({
        category: String(m.name ?? `方法 ${idx + 1}`),
        description: String(m.description ?? ""),
        key_papers: [],
        strengths: String(m.pros ?? ""),
        weaknesses: String(m.cons ?? ""),
      }))
    : [];

  const trendsFromOld = Array.isArray(raw.research_trends)
    ? (raw.research_trends as Array<Record<string, unknown>>).map((t) => ({
        trend: String(t.trend ?? ""),
        description: String(t.description ?? ""),
        evidence: String(t.evidence ?? ""),
      }))
    : [];

  const trendsFromStructured = Array.isArray(report.research_trends)
    ? (report.research_trends as Array<Record<string, unknown>>).map((t) => ({
        trend: String(t.trend ?? ""),
        description: String(t.signal ?? ""),
        evidence: "",
      }))
    : [];

  const gapsFromOld = Array.isArray(raw.existing_gaps)
    ? raw.existing_gaps.map((g) => String(g))
    : [];

  const gapsFromStructured = Array.isArray(report.challenges)
    ? report.challenges.map((g) => String(g))
    : [];

  const futureFromOld = Array.isArray(raw.future_directions)
    ? (raw.future_directions as Array<Record<string, unknown>>).map((d) => ({
        direction: String(d.direction ?? ""),
        rationale: String(d.rationale ?? ""),
      }))
    : [];

  const futureFromStructured = Array.isArray(report.recommended_topics)
    ? (report.recommended_topics as Array<Record<string, unknown>>).map((d) => ({
        direction: String(d.topic ?? ""),
        rationale: `${String(d.why ?? "")} ${String(d.first_step ? `第一步：${d.first_step}` : "")}`.trim(),
      }))
    : [];

  const papers = Array.isArray(raw.papers)
    ? (raw.papers as Array<Record<string, unknown>>).map((p) => ({
        id: p.id ? String(p.id) : undefined,
        title: String(p.title ?? "未命名论文"),
        authors: String(p.authors ?? "未知作者"),
        year: Number(p.year ?? 0),
        abstract: String(p.abstract ?? ""),
        venue: String(p.venue ?? ""),
        citation_count: Number(p.citation_count ?? 0),
        pdf_url: String(p.pdf_url ?? ""),
        doi: String(p.doi ?? ""),
      }))
    : [];

  return {
    query,
    background,
    representative_methods: methodsFromOld.length > 0 ? methodsFromOld : methodsFromStructured,
    research_trends: trendsFromOld.length > 0 ? trendsFromOld : trendsFromStructured,
    existing_gaps: gapsFromOld.length > 0 ? gapsFromOld : gapsFromStructured,
    future_directions: futureFromOld.length > 0 ? futureFromOld : futureFromStructured,
    key_takeaways:
      (raw.key_takeaways as string | undefined) ??
      (report.overall_summary as string | undefined),
    papers,
  };
}

function normalizeWorkflow(raw: Record<string, unknown>, normalized: SurveyData): AgentStep[] {
  const workflow = raw.agent_workflow;
  if (Array.isArray(workflow)) {
    return workflow.map((step, idx) => {
      const item = step as Record<string, unknown>;
      const statusRaw = String(item.status ?? "pending");
      const status: AgentStatus =
        statusRaw === "done" || statusRaw === "failed" || statusRaw === "running"
          ? statusRaw
          : "pending";
      return {
        id: String(item.id ?? `agent_${idx}`),
        name: String(item.name ?? `Agent ${idx + 1}`),
        role: String(item.role ?? "执行任务"),
        status,
        summary: item.summary ? String(item.summary) : undefined,
        error: item.error ? String(item.error) : undefined,
      };
    });
  }

  return [
    {
      id: "planner",
      name: "Intent Planner",
      role: "规划研究范围与检索策略",
      status: "done",
      summary: `已完成「${normalized.query}」的综述范围拆解`,
    },
    {
      id: "retriever",
      name: "Literature Retriever",
      role: "自动检索相关文献",
      status: "done",
      summary: `已检索到 ${normalized.papers.length} 篇候选论文`,
    },
    {
      id: "writer",
      name: "Survey Writer",
      role: "生成结构化文献综述",
      status: "done",
      summary: "已输出研究背景、方法、趋势与建议研究方向",
    },
  ];
}

function statusBadgeTone(status: AgentStatus) {
  if (status === "done") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "running") return "warning" as const;
  return "default" as const;
}

function statusLabel(status: AgentStatus) {
  if (status === "done") return "完成";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  return "等待中";
}

function statusIcon(status: AgentStatus) {
  if (status === "done") return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === "failed") return <XCircle className="w-3.5 h-3.5" />;
  return <Clock3 className="w-3.5 h-3.5" />;
}

export default function SurveyPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SurveyData | null>(null);
  const [workflow, setWorkflow] = useState<AgentStep[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"survey" | "papers">("survey");
  const timersRef = useRef<number[]>([]);

  const clearFlowTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const startFlowSimulation = () => {
    clearFlowTimers();
    setWorkflow((prev) => {
      const base = prev.length > 0 ? prev : getDefaultWorkflow();
      return base.map((step, index) => ({
        ...step,
        status: index === 0 ? "running" : "pending",
        summary: undefined,
        error: undefined,
      }));
    });

    const t1 = window.setTimeout(() => {
      setWorkflow((prev) =>
        prev.map((step, idx) => {
          if (idx === 0) return { ...step, status: "done", summary: "已生成检索与覆盖主题规划" };
          if (idx === 1) return { ...step, status: "running" };
          return step;
        })
      );
    }, 800);

    const t2 = window.setTimeout(() => {
      setWorkflow((prev) =>
        prev.map((step, idx) => {
          if (idx === 1) return { ...step, status: "done", summary: "正在汇总候选文献与证据" };
          if (idx === 2) return { ...step, status: "running" };
          return step;
        })
      );
    }, 1600);

    timersRef.current = [t1, t2];
  };

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setWorkflow(getDefaultWorkflow());
    startFlowSimulation();
    try {
      const res = await surveyApi.generate(query) as { data?: Record<string, unknown> } | Record<string, unknown>;
      const payload = ((res as { data?: Record<string, unknown> })?.data ?? res) as Record<string, unknown>;
      const normalized = normalizeSurvey(payload, query.trim());
      setResult(normalized);
      setWorkflow(normalizeWorkflow(payload, normalized));
    } catch (e) {
      setWorkflow((prev) => {
        const cloned = prev.length > 0 ? [...prev] : getDefaultWorkflow();
        const runningIndex = cloned.findIndex((s) => s.status === "running");
        const index = runningIndex >= 0 ? runningIndex : 0;
        cloned[index] = {
          ...cloned[index],
          status: "failed",
          error: e instanceof Error ? e.message : "生成失败",
        };
        return cloned;
      });
      setError(e instanceof Error ? e.message : "生成失败，请重试");
    } finally {
      clearFlowTimers();
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">文献调研与综述</h1>
          <p className="text-sm text-gray-500">输入研究关键词，自动检索论文并生成结构化综述</p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex gap-3">
          <Input
            placeholder="例如：graph neural network for drug discovery..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="flex-1"
          />
          <Button onClick={handleGenerate} loading={loading} size="md">
            <Sparkles className="w-4 h-4" />
            {loading ? "调研中..." : "生成综述"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </Card>

      {(workflow.length > 0 || loading) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>多 Agent 协作流程</CardTitle>
            <GitBranch className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <div className="space-y-3">
            {(workflow.length > 0 ? workflow : getDefaultWorkflow()).map((step) => (
              <div key={step.id} className="rounded-xl border border-gray-200 p-3 bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{step.name}</div>
                      <div className="text-xs text-gray-500 truncate">{step.role}</div>
                    </div>
                  </div>
                  <Badge variant={statusBadgeTone(step.status)}>
                    <span className="inline-flex items-center gap-1">
                      {statusIcon(step.status)}
                      {statusLabel(step.status)}
                    </span>
                  </Badge>
                </div>
                {(step.summary || step.error) && (
                  <p className={`mt-2 text-xs ${step.error ? "text-red-600" : "text-gray-600"}`}>
                    {step.error || step.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {result && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {[{ key: "survey", label: "综述报告" }, { key: "papers", label: `检索论文 (${result.papers.length || 0})` }].map(
              ({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as "survey" | "papers")}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {activeTab === "survey" && (
            <div className="space-y-5">
              {/* Background */}
              {result.background && (
                <Card>
                  <CardHeader><CardTitle>研究背景</CardTitle></CardHeader>
                  <p className="text-gray-700 leading-relaxed">{result.background}</p>
                </Card>
              )}

              {/* Methods */}
              {result.representative_methods.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>代表性方法分类</CardTitle></CardHeader>
                  <div className="space-y-4">
                    {result.representative_methods.map((m, i) => (
                      <div key={i} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{m.category}</h4>
                          <div className="flex gap-1">
                            {m.key_papers?.map((n) => (
                              <span key={n} className="text-xs text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">[{n}]</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{m.description}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="text-xs">
                            <span className="text-green-700 font-medium">优势：</span>
                            <span className="text-gray-600">{m.strengths}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-amber-700 font-medium">局限：</span>
                            <span className="text-gray-600">{m.weaknesses}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Trends */}
              {result.research_trends.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>研究趋势</CardTitle>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                  </CardHeader>
                  <div className="space-y-3">
                    {result.research_trends.map((t, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-1 bg-brand-200 rounded-full flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm text-gray-900">{t.trend}</div>
                          <div className="text-sm text-gray-600 mt-0.5">{t.description}</div>
                          {t.evidence && <div className="text-xs text-gray-400 mt-0.5 italic">{t.evidence}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="grid sm:grid-cols-2 gap-5">
                {/* Gaps */}
                {result.existing_gaps && result.existing_gaps.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>现有不足</CardTitle>
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    </CardHeader>
                    <ul className="space-y-2">
                      {result.existing_gaps.map((g, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">⚠</span>{g}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Future Directions */}
                {result.future_directions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>未来方向</CardTitle>
                      <Lightbulb className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <div className="space-y-2">
                      {result.future_directions.map((d, i) => (
                        <div key={i} className="p-2.5 bg-emerald-50 rounded-lg">
                          <div className="font-medium text-sm text-emerald-900">{d.direction}</div>
                          <div className="text-xs text-emerald-700 mt-0.5">{d.rationale}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {/* Takeaways */}
              {result.key_takeaways && (
                <Card className="bg-brand-50 border-brand-200">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-brand-900 mb-1">核心总结</div>
                      <p className="text-brand-800 text-sm leading-relaxed">{result.key_takeaways}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === "papers" && (
            <div className="space-y-3">
              {result.papers.map((p, i) => (
                <Card key={i} padding="sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-300 mt-0.5">[{i + 1}]</span>
                        <h3 className="font-medium text-gray-900 text-sm leading-snug">{p.title}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 ml-5 mb-2">
                        <span className="text-xs text-gray-500">{p.authors}</span>
                        {p.year && <Badge variant="info">{p.year}</Badge>}
                        {p.venue && <Badge>{p.venue}</Badge>}
                        {p.citation_count > 0 && (
                          <Badge variant="success">引用 {p.citation_count}</Badge>
                        )}
                      </div>
                      {p.abstract && (
                        <p className="text-xs text-gray-600 ml-5 line-clamp-2">{p.abstract}</p>
                      )}
                    </div>
                    {p.pdf_url && (
                      <a href={p.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-brand-600 hover:text-brand-700">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
