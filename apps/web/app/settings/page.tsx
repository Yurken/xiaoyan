"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import { Bot, BrainCircuit, Database, KeyRound, Network, Settings2, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/client";
import type { AppSettings, LlmProvider, MultiAgentRoutingMode } from "@research-copilot/types";

const MASK = "***";

const DEFAULT_SETTINGS: AppSettings = {
  llm_provider: "openai_compatible",
  openai_api_key: "",
  openai_base_url: "https://api.openai.com/v1",
  openai_chat_model: "gpt-4o-mini",
  openai_embedding_model: "text-embedding-3-small",
  anthropic_api_key: "",
  anthropic_chat_model: "claude-3-5-haiku-20241022",
  openai_compatible_base_url: "",
  openai_compatible_api_key: "",
  openai_compatible_chat_model: "deepseek-chat",
  openai_compatible_embedding_model: "BAAI/bge-m3",
  embedding_base_url: "",
  embedding_api_key: "",
  embedding_model: "",
  chunk_size: "800",
  chunk_overlap: "150",
  rag_top_k: "5",
  semantic_scholar_api_key: "",
  planner_hint_model: "",
  planner_hint_temperature: "0.2",
  planner_analysis_model: "",
  planner_analysis_temperature: "0.2",
  planner_generation_model: "",
  planner_generation_temperature: "0.3",
  survey_planner_model: "",
  survey_planner_temperature: "0.2",
  survey_writer_model: "",
  survey_writer_temperature: "0.3",
  paper_analysis_model: "",
  paper_analysis_temperature: "0.3",
  paper_reproduction_model: "",
  paper_reproduction_temperature: "0.25",
  copilot_simple_model: "",
  copilot_simple_temperature: "0.4",
  multi_agent_enabled: "true",
  multi_agent_routing_mode: "hybrid",
  multi_agent_enabled_agents: "retrieval,planner,literature_scout,survey,paper_analyst,reproduction,synthesis",
  multi_agent_max_steps: "4",
  multi_agent_search_limit: "8",
  multi_agent_supervisor_model: "",
  multi_agent_supervisor_temperature: "0.1",
  multi_agent_worker_model: "",
  multi_agent_worker_temperature: "0.3",
  multi_agent_planner_model: "",
  multi_agent_planner_temperature: "",
  multi_agent_literature_scout_model: "",
  multi_agent_literature_scout_temperature: "",
  multi_agent_survey_model: "",
  multi_agent_survey_temperature: "",
  multi_agent_paper_analyst_model: "",
  multi_agent_paper_analyst_temperature: "",
  multi_agent_reproduction_model: "",
  multi_agent_reproduction_temperature: "",
  multi_agent_synthesis_model: "",
  multi_agent_synthesis_temperature: "0.4",
  paper_visible_venue_tags: "ccf_rating,ccf_type,wos_indexes,jcr_quartile,cas_quartile,cas_top",
};

const AGENT_OPTIONS = [
  ["retrieval", "检索"],
  ["planner", "路径规划"],
  ["literature_scout", "论文侦察"],
  ["survey", "综述生成"],
  ["paper_analyst", "论文解析"],
  ["reproduction", "复现建议"],
  ["synthesis", "最终整合"],
] as const;

function SettingSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof BrainCircuit;
  children: ReactNode;
}) {
  return (
    <Card className="border border-white/60">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function ModeChip({
  active,
  onClick,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
        active
          ? "border-brand-300 bg-brand-50 shadow-[0_12px_30px_rgba(0,122,255,0.12)]"
          : "border-slate-200 bg-white/70 hover:border-slate-300"
      }`}
    >
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
    </button>
  );
}

function AgentToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-sm transition-all ${
        active
          ? "bg-slate-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]"
          : "bg-white text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.28)] hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const setField = (key: keyof AppSettings, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiClient.settings.get();
        if (!cancelled) {
          setForm({ ...DEFAULT_SETTINGS, ...data });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载设置失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledAgents = form.multi_agent_enabled_agents
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const toggleAgent = (agent: string) => {
    const next = enabledAgents.includes(agent)
      ? enabledAgents.filter((item) => item !== agent)
      : [...enabledAgents, agent];
    setField("multi_agent_enabled_agents", next.join(","));
  };

  const provider = form.llm_provider as LlmProvider;
  const routingMode = form.multi_agent_routing_mode as MultiAgentRoutingMode;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await apiClient.settings.update(form);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="info" className="mb-3 bg-white/80 text-slate-700">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Multi-Agent 控制台
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">设置中心</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              把模型、RAG、supervisor 路由和 specialist agent 行为统一收拢到这里。Web 端默认走同源代理，不需要单独配置 API 地址。
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm font-medium text-emerald-600">设置已保存</span>}
            <Button onClick={save} loading={saving}>
              保存全部配置
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border border-rose-200 bg-rose-50/80 text-sm text-rose-700">
            {error}
          </Card>
        )}

        {loading ? (
          <Card className="text-sm text-slate-500">正在从后端加载配置…</Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <SettingSection
                icon={KeyRound}
                title="模型服务"
                description="主对话模型与 Embedding 基础配置。"
              >
                <div className="mb-5 flex flex-wrap gap-3">
                  {([
                    ["openai_compatible", "兼容接口"],
                    ["openai", "OpenAI"],
                    ["anthropic", "Anthropic"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setField("llm_provider", value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        provider === value
                          ? "bg-brand-600 text-white shadow-[0_16px_35px_rgba(0,122,255,0.22)]"
                          : "bg-white text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.28)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {provider === "openai_compatible" && (
                    <>
                      <Input
                        label="兼容 API Base URL"
                        value={form.openai_compatible_base_url}
                        onChange={(event) => setField("openai_compatible_base_url", event.target.value)}
                        placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                      />
                      <Input
                        label="兼容 API Key"
                        value={form.openai_compatible_api_key}
                        onChange={(event) => setField("openai_compatible_api_key", event.target.value)}
                        placeholder="sk-..."
                        type="password"
                      />
                      <Input
                        label="兼容对话模型"
                        value={form.openai_compatible_chat_model}
                        onChange={(event) => setField("openai_compatible_chat_model", event.target.value)}
                        placeholder="deepseek-chat"
                      />
                      <Input
                        label="兼容 Embedding 模型"
                        value={form.openai_compatible_embedding_model}
                        onChange={(event) => setField("openai_compatible_embedding_model", event.target.value)}
                        placeholder="BAAI/bge-m3"
                      />
                    </>
                  )}

                  {provider === "openai" && (
                    <>
                      <Input
                        label="OpenAI Base URL"
                        value={form.openai_base_url}
                        onChange={(event) => setField("openai_base_url", event.target.value)}
                        placeholder="https://api.openai.com/v1"
                      />
                      <Input
                        label="OpenAI API Key"
                        value={form.openai_api_key}
                        onChange={(event) => setField("openai_api_key", event.target.value)}
                        placeholder="sk-..."
                        type="password"
                      />
                      <Input
                        label="OpenAI 对话模型"
                        value={form.openai_chat_model}
                        onChange={(event) => setField("openai_chat_model", event.target.value)}
                        placeholder="gpt-4o-mini"
                      />
                      <Input
                        label="OpenAI Embedding 模型"
                        value={form.openai_embedding_model}
                        onChange={(event) => setField("openai_embedding_model", event.target.value)}
                        placeholder="text-embedding-3-small"
                      />
                    </>
                  )}

                  {provider === "anthropic" && (
                    <>
                      <Input
                        label="Anthropic API Key"
                        value={form.anthropic_api_key}
                        onChange={(event) => setField("anthropic_api_key", event.target.value)}
                        placeholder="sk-ant-..."
                        type="password"
                      />
                      <Input
                        label="Anthropic 对话模型"
                        value={form.anthropic_chat_model}
                        onChange={(event) => setField("anthropic_chat_model", event.target.value)}
                        placeholder="claude-3-5-haiku-20241022"
                      />
                    </>
                  )}

                  <Input
                    label="Semantic Scholar API Key"
                    value={form.semantic_scholar_api_key}
                    onChange={(event) => setField("semantic_scholar_api_key", event.target.value)}
                    placeholder={MASK}
                    type="password"
                  />
                </div>
              </SettingSection>

              <SettingSection
                icon={Database}
                title="RAG 检索"
                description="控制切块、重叠和默认召回数量。"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Input
                    label="Chunk Size"
                    value={form.chunk_size}
                    onChange={(event) => setField("chunk_size", event.target.value)}
                    placeholder="800"
                  />
                  <Input
                    label="Chunk Overlap"
                    value={form.chunk_overlap}
                    onChange={(event) => setField("chunk_overlap", event.target.value)}
                    placeholder="150"
                  />
                  <Input
                    label="Top-K"
                    value={form.rag_top_k}
                    onChange={(event) => setField("rag_top_k", event.target.value)}
                    placeholder="5"
                  />
                </div>
              </SettingSection>
            </div>

            <div className="space-y-6">
              <SettingSection
                icon={Bot}
                title="多 Agent 编排"
                description="决定 supervisor 是否开启、如何路由，以及每类 specialist 的模型与温度。"
              >
                <div className="space-y-5">
                  <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">启用 Multi-Agent</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          关闭后仍然会保留最终回答能力，但不会走 supervisor 拆解。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setField("multi_agent_enabled", form.multi_agent_enabled === "true" ? "false" : "true")}
                        className={`relative h-8 w-16 rounded-full transition-colors ${
                          form.multi_agent_enabled === "true" ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                            form.multi_agent_enabled === "true" ? "translate-x-9" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="text-sm font-semibold text-slate-900">路由模式</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <ModeChip
                        active={routingMode === "rule"}
                        onClick={() => setField("multi_agent_routing_mode", "rule")}
                        label="Rule"
                        description="稳定、可预期，全部由规则判断。"
                      />
                      <ModeChip
                        active={routingMode === "llm"}
                        onClick={() => setField("multi_agent_routing_mode", "llm")}
                        label="LLM"
                        description="完全交给 supervisor 模型规划。"
                      />
                      <ModeChip
                        active={routingMode === "hybrid"}
                        onClick={() => setField("multi_agent_routing_mode", "hybrid")}
                        label="Hybrid"
                        description="规则兜底，优先用 supervisor 精修。"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-semibold text-slate-900">启用的 specialist</div>
                    <div className="flex flex-wrap gap-2">
                      {AGENT_OPTIONS.map(([value, label]) => (
                        <AgentToggle
                          key={value}
                          active={enabledAgents.includes(value)}
                          onClick={() => toggleAgent(value)}
                          label={label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="最大 specialist 步数"
                      value={form.multi_agent_max_steps}
                      onChange={(event) => setField("multi_agent_max_steps", event.target.value)}
                      placeholder="4"
                    />
                    <Input
                      label="外部检索上限"
                      value={form.multi_agent_search_limit}
                      onChange={(event) => setField("multi_agent_search_limit", event.target.value)}
                      placeholder="8"
                    />
                    <Input
                      label="Supervisor 模型"
                      value={form.multi_agent_supervisor_model}
                      onChange={(event) => setField("multi_agent_supervisor_model", event.target.value)}
                      placeholder="留空则沿用主对话模型"
                    />
                    <Input
                      label="Supervisor Temperature"
                      value={form.multi_agent_supervisor_temperature}
                      onChange={(event) => setField("multi_agent_supervisor_temperature", event.target.value)}
                      placeholder="0.1"
                    />
                    <Input
                      label="Worker 模型"
                      value={form.multi_agent_worker_model}
                      onChange={(event) => setField("multi_agent_worker_model", event.target.value)}
                      placeholder="留空则沿用主对话模型"
                    />
                    <Input
                      label="Worker Temperature"
                      value={form.multi_agent_worker_temperature}
                      onChange={(event) => setField("multi_agent_worker_temperature", event.target.value)}
                      placeholder="0.3"
                    />
                    <Input
                      label="Synthesis 模型"
                      value={form.multi_agent_synthesis_model}
                      onChange={(event) => setField("multi_agent_synthesis_model", event.target.value)}
                      placeholder="留空则沿用主对话模型"
                    />
                    <Input
                      label="Synthesis Temperature"
                      value={form.multi_agent_synthesis_temperature}
                      onChange={(event) => setField("multi_agent_synthesis_temperature", event.target.value)}
                      placeholder="0.4"
                    />
                  </div>
                </div>
              </SettingSection>

              <Card className="border border-white/60 bg-slate-950 text-white">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Network className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">编排建议</div>
                    <div className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
                      <p>日常问答：`hybrid` + 4 步以内，避免链路膨胀。</p>
                      <p>论文精读：保留 `retrieval,paper_analyst,reproduction,synthesis`。</p>
                      <p>综述写作：保留 `retrieval,literature_scout,survey,synthesis`。</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border border-white/60">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">当前启用摘要</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="success">Routing: {routingMode}</Badge>
                      <Badge variant="info">Agents: {enabledAgents.length}</Badge>
                      <Badge variant="default">Top-K: {form.multi_agent_search_limit}</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
