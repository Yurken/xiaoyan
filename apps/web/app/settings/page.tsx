"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import { Bot, BrainCircuit, ChevronDown, Database, Network, Settings2, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/client";
import type { AppSettings, MultiAgentRoutingMode } from "@research-copilot/types";

const DEFAULT_SETTINGS: AppSettings = {
  llm_provider: "openai_compatible",
  openai_api_key: "",
  openai_base_url: "https://api.openai.com/v1",
  openai_chat_model: "",
  openai_embedding_model: "text-embedding-3-small",
  anthropic_api_key: "",
  anthropic_chat_model: "",
  openai_compatible_base_url: "",
  openai_compatible_api_key: "",
  openai_compatible_chat_model: "",
  openai_compatible_embedding_model: "BAAI/bge-m3",
  embedding_base_url: "",
  embedding_api_key: "",
  embedding_model: "",
  chunk_size: "800",
  chunk_overlap: "150",
  rag_top_k: "5",
  paper_search_engine: "arxiv",
  semantic_scholar_api_key: "",
  planner_hint_model: "",
  planner_hint_base_url: "",
  planner_hint_api_key: "",
  planner_hint_temperature: "0.2",
  planner_hint_top_p: "",
  planner_hint_max_tokens: "16384",
  planner_hint_presence_penalty: "",
  planner_hint_frequency_penalty: "",
  planner_analysis_model: "",
  planner_analysis_base_url: "",
  planner_analysis_api_key: "",
  planner_analysis_temperature: "0.2",
  planner_analysis_top_p: "",
  planner_analysis_max_tokens: "16384",
  planner_analysis_presence_penalty: "",
  planner_analysis_frequency_penalty: "",
  planner_generation_model: "",
  planner_generation_base_url: "",
  planner_generation_api_key: "",
  planner_generation_temperature: "0.3",
  planner_generation_top_p: "",
  planner_generation_max_tokens: "16384",
  planner_generation_presence_penalty: "",
  planner_generation_frequency_penalty: "",
  survey_planner_model: "",
  survey_planner_base_url: "",
  survey_planner_api_key: "",
  survey_planner_temperature: "0.2",
  survey_planner_top_p: "",
  survey_planner_max_tokens: "16384",
  survey_planner_presence_penalty: "",
  survey_planner_frequency_penalty: "",
  survey_writer_model: "",
  survey_writer_base_url: "",
  survey_writer_api_key: "",
  survey_writer_temperature: "0.3",
  survey_writer_top_p: "",
  survey_writer_max_tokens: "16384",
  survey_writer_presence_penalty: "",
  survey_writer_frequency_penalty: "",
  paper_analysis_model: "",
  paper_analysis_base_url: "",
  paper_analysis_api_key: "",
  paper_analysis_temperature: "0.3",
  paper_analysis_top_p: "",
  paper_analysis_max_tokens: "16384",
  paper_analysis_presence_penalty: "",
  paper_analysis_frequency_penalty: "",
  paper_reproduction_model: "",
  paper_reproduction_base_url: "",
  paper_reproduction_api_key: "",
  paper_reproduction_temperature: "0.25",
  paper_reproduction_top_p: "",
  paper_reproduction_max_tokens: "16384",
  paper_reproduction_presence_penalty: "",
  paper_reproduction_frequency_penalty: "",
  copilot_simple_model: "",
  copilot_simple_base_url: "",
  copilot_simple_api_key: "",
  copilot_simple_temperature: "0.4",
  copilot_simple_top_p: "",
  copilot_simple_max_tokens: "16384",
  copilot_simple_presence_penalty: "",
  copilot_simple_frequency_penalty: "",
  xiaoyan_long_term_memory_enabled: "true",
  xiaoyan_companion_id: "xiaoyan",
  xiaoyan_active_researcher_enabled: "true",
  multi_agent_enabled: "true",
  multi_agent_routing_mode: "hybrid",
  multi_agent_enabled_agents: "retrieval,planner,literature_scout,survey,paper_analyst,reproduction,synthesis",
  multi_agent_max_steps: "6",
  multi_agent_search_limit: "8",
  multi_agent_supervisor_model: "",
  multi_agent_supervisor_base_url: "",
  multi_agent_supervisor_api_key: "",
  multi_agent_supervisor_temperature: "0.1",
  multi_agent_supervisor_top_p: "",
  multi_agent_supervisor_max_tokens: "16384",
  multi_agent_supervisor_presence_penalty: "",
  multi_agent_supervisor_frequency_penalty: "",
  multi_agent_worker_model: "",
  multi_agent_worker_base_url: "",
  multi_agent_worker_api_key: "",
  multi_agent_worker_temperature: "0.3",
  multi_agent_worker_top_p: "",
  multi_agent_worker_max_tokens: "16384",
  multi_agent_worker_presence_penalty: "",
  multi_agent_worker_frequency_penalty: "",
  multi_agent_planner_model: "",
  multi_agent_planner_base_url: "",
  multi_agent_planner_api_key: "",
  multi_agent_planner_temperature: "",
  multi_agent_planner_top_p: "",
  multi_agent_planner_max_tokens: "16384",
  multi_agent_planner_presence_penalty: "",
  multi_agent_planner_frequency_penalty: "",
  multi_agent_literature_scout_model: "",
  multi_agent_literature_scout_base_url: "",
  multi_agent_literature_scout_api_key: "",
  multi_agent_literature_scout_temperature: "",
  multi_agent_literature_scout_top_p: "",
  multi_agent_literature_scout_max_tokens: "16384",
  multi_agent_literature_scout_presence_penalty: "",
  multi_agent_literature_scout_frequency_penalty: "",
  multi_agent_survey_model: "",
  multi_agent_survey_base_url: "",
  multi_agent_survey_api_key: "",
  multi_agent_survey_temperature: "",
  multi_agent_survey_top_p: "",
  multi_agent_survey_max_tokens: "16384",
  multi_agent_survey_presence_penalty: "",
  multi_agent_survey_frequency_penalty: "",
  multi_agent_paper_analyst_model: "",
  multi_agent_paper_analyst_base_url: "",
  multi_agent_paper_analyst_api_key: "",
  multi_agent_paper_analyst_temperature: "",
  multi_agent_paper_analyst_top_p: "",
  multi_agent_paper_analyst_max_tokens: "16384",
  multi_agent_paper_analyst_presence_penalty: "",
  multi_agent_paper_analyst_frequency_penalty: "",
  multi_agent_reproduction_model: "",
  multi_agent_reproduction_base_url: "",
  multi_agent_reproduction_api_key: "",
  multi_agent_reproduction_temperature: "",
  multi_agent_reproduction_top_p: "",
  multi_agent_reproduction_max_tokens: "16384",
  multi_agent_reproduction_presence_penalty: "",
  multi_agent_reproduction_frequency_penalty: "",
  multi_agent_synthesis_model: "",
  multi_agent_synthesis_base_url: "",
  multi_agent_synthesis_api_key: "",
  multi_agent_synthesis_temperature: "0.4",
  multi_agent_synthesis_top_p: "",
  multi_agent_synthesis_max_tokens: "16384",
  multi_agent_synthesis_presence_penalty: "",
  multi_agent_synthesis_frequency_penalty: "",
  paper_visible_venue_tags: "ccf_rating,ccf_type,wos_indexes,jcr_quartile,cas_quartile,cas_top",
  paper_import_recognize_title: "true",
  paper_import_recognize_authors: "true",
  paper_import_recognize_year: "true",
  paper_import_recognize_venue: "true",
  paper_import_recognize_keywords: "true",
  paper_auto_rename_on_import: "false",
  paper_auto_rename_rule: "{first_author} - {title} ({year})",
  vision_model: "",
  vision_base_url: "",
  vision_api_key: "",
  vision_temperature: "0.2",
  vision_top_p: "",
  vision_max_tokens: "16384",
  vision_presence_penalty: "",
  vision_frequency_penalty: "",
  translation_model: "",
  translation_base_url: "",
  translation_api_key: "",
  translation_temperature: "0.1",
  translation_top_p: "",
  translation_max_tokens: "16384",
  translation_presence_penalty: "",
  translation_frequency_penalty: "",
  app_lock_enabled: "false",
  app_lock_password_salt: "",
  app_lock_password_hash: "",
  app_lock_timeout_minutes: "0",
  web_search_enabled: "false",
  web_search_provider: "duckduckgo",
  tavily_api_key: "",
};

const AGENT_OPTIONS = [
  ["retrieval", "溯源模型"],
  ["planner", "谋策模型"],
  ["literature_scout", "探知模型"],
  ["survey", "翰章模型"],
  ["paper_analyst", "洞见模型"],
  ["reproduction", "构域模型"],
  ["synthesis", "整合模型"],
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

function AgentConfigPanel({
  title,
  subtitle,
  agentKey,
  form,
  setField,
}: {
  title: string;
  subtitle: string;
  agentKey: string;
  form: AppSettings;
  setField: (key: keyof AppSettings, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const k = (suffix: string) => `multi_agent_${agentKey}_${suffix}` as keyof AppSettings;
  const hasValue = [k("model"), k("base_url"), k("api_key"), k("temperature"), k("top_p")].some(
    (key) => form[key] !== "",
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {hasValue && (
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          )}
          <div className="text-xs text-slate-400">{subtitle}</div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
          <Input
            label="model"
            value={form[k("model")]}
            onChange={(e) => setField(k("model"), e.target.value)}
            placeholder="留空则继承默认"
          />
          <Input
            label="base_url"
            value={form[k("base_url")]}
            onChange={(e) => setField(k("base_url"), e.target.value)}
            placeholder="留空则继承默认"
          />
          <Input
            label="api_key"
            value={form[k("api_key")]}
            onChange={(e) => setField(k("api_key"), e.target.value)}
            placeholder="留空则继承默认"
            type="password"
          />
          <Input
            label="temperature"
            value={form[k("temperature")]}
            onChange={(e) => setField(k("temperature"), e.target.value)}
            placeholder="留空则继承默认"
          />
          <Input
            label="top_p"
            value={form[k("top_p")]}
            onChange={(e) => setField(k("top_p"), e.target.value)}
            placeholder="留空则不设置"
          />
        </div>
      )}
    </div>
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
              多能力域模型控制台
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">设置中心</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              集中管理模型、RAG 和调度策略，让小妍的能力更贴合你的研究习惯。Web 端默认走同源代理，无需单独配置 API 地址。
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
              {/* 模型服务（模型分工）区域已移至多能力域模型编排中，每个能力域模型独立配置 */}

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

              <SettingSection
                icon={Network}
                title="外部学术服务"
                description="配置第三方学术数据接口的访问密钥，提升检索频次上限。"
              >
                <div className="space-y-2">
                  <Input
                    label="Semantic Scholar API Key"
                    type="password"
                    value={form.semantic_scholar_api_key}
                    onChange={(event) => setField("semantic_scholar_api_key", event.target.value)}
                    placeholder="留空使用免费限速额度"
                  />
                  <p className="text-xs text-slate-400 ml-1">
                    免费额度约 1 次/秒；申请 Key 可提升频次：
                    <a
                      href="https://www.semanticscholar.org/product/api#api-key-form"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-500 underline underline-offset-2 hover:text-blue-700"
                    >
                      semanticscholar.org/product/api
                    </a>
                  </p>
                </div>
              </SettingSection>
            </div>

            <div className="space-y-6">
              <SettingSection
                icon={Bot}
                title="多能力域模型编排"
                description="控制调度器是否启用、路由策略，以及各能力域模型的模型与参数。"
              >
                <div className="space-y-5">
                  <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">启用多能力域模型</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          关闭后小妍仍能直接回复，但不再通过调度器拆解任务。
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
                        label="规则"
                        description="稳定、可预期，全部由规则判断。"
                      />
                      <ModeChip
                        active={routingMode === "llm"}
                        onClick={() => setField("multi_agent_routing_mode", "llm")}
                        label="模型"
                        description="完全交由调度器模型规划。"
                      />
                      <ModeChip
                        active={routingMode === "hybrid"}
                        onClick={() => setField("multi_agent_routing_mode", "hybrid")}
                        label="混合"
                        description="规则兜底，优先由调度器精修。"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-semibold text-slate-900">启用的能力域模型</div>
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

                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="单次最多执行的能力域模型步数"
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
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-900">能力域模型配置</div>
                    <p className="text-xs leading-5 text-slate-500">
                      每个能力域模型可独立设置模型、地址、密钥和采样参数，留空则继承默认值。
                    </p>
                    <div className="space-y-2 pt-1">
                      <AgentConfigPanel
                        title="谋策调度模型"
                        subtitle="调度器"
                        agentKey="supervisor"
                        form={form}
                        setField={setField}
                      />
                      <AgentConfigPanel
                        title="小妍默认执行模型"
                        subtitle="默认执行"
                        agentKey="worker"
                        form={form}
                        setField={setField}
                      />
                      <AgentConfigPanel
                        title="谋策模型"
                        subtitle="路径规划"
                        agentKey="planner"
                        form={form}
                        setField={setField}
                      />
                      <AgentConfigPanel
                        title="探知模型"
                        subtitle="论文侦察"
                        agentKey="literature_scout"
                        form={form}
                        setField={setField}
                      />
                      <AgentConfigPanel
                        title="翰章模型"
                        subtitle="综述生成"
                        agentKey="survey"
                        form={form}
                        setField={setField}
                      />
                      <AgentConfigPanel
                        title="洞见模型"
                        subtitle="论文解析"
                        agentKey="paper_analyst"
                        form={form}
                        setField={setField}
                      />
                      <AgentConfigPanel
                        title="构域模型"
                        subtitle="复现建议"
                        agentKey="reproduction"
                        form={form}
                        setField={setField}
                      />
                      <AgentConfigPanel
                        title="整合模型"
                        subtitle="最终整合"
                        agentKey="synthesis"
                        form={form}
                        setField={setField}
                      />
                    </div>
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
                      <p>论文精读：优先启用溯源模型、洞见模型、构域模型与整合模型。</p>
                      <p>综述写作：优先启用溯源模型、探知模型、翰章模型与整合模型。</p>
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
                      <Badge variant="success">路由模式: {routingMode}</Badge>
                      <Badge variant="info">模型数: {enabledAgents.length}</Badge>
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
