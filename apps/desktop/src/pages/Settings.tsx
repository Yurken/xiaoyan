import { useState, useEffect, type ComponentType } from "react";
import { Brain, Database, Info, Eye, EyeOff, CheckCircle, Loader2, AlertCircle, Bot, Wifi } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { AppSettings, LlmProvider, MultiAgentRoutingMode } from "@research-copilot/types";

// ── helpers ──────────────────────────────────────────────────────

function SettingInput({
  label,
  value,
  onChange,
  placeholder,
  sensitive,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  sensitive?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const type = sensitive && !show ? "password" : "text";

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ink-tertiary ml-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 transition-shadow duration-150 pr-10"
          style={{
            background: "#E8ECF0",
            boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow =
              "inset 3px 3px 7px #C0C5CB, inset -3px -3px 7px #FFFFFF, 0 0 0 2px rgba(0,122,255,0.2)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow =
              "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF";
          }}
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-ink-tertiary ml-1">{hint}</p>}
    </div>
  );
}

function ProviderTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
      style={
        active
          ? {
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              color: "#FFFFFF",
              boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
            }
          : {
              background: "#E8ECF0",
              color: "#3C3C43",
              boxShadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
            }
      }
    >
      {label}
    </button>
  );
}

function SectionIcon({ icon: Icon, color }: { icon: ComponentType<{ className?: string }>; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: "#E8ECF0",
        boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
        color,
      }}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}

function AgentChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-2xl text-xs font-medium transition-all duration-150"
      style={
        active
          ? {
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              color: "#FFFFFF",
              boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
            }
          : {
              background: "#E8ECF0",
              color: "#3C3C43",
              boxShadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
            }
      }
    >
      {label}
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────

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
  multi_agent_enabled: "true",
  multi_agent_routing_mode: "hybrid",
  multi_agent_enabled_agents: "retrieval,planner,literature_scout,survey,paper_analyst,reproduction,synthesis",
  multi_agent_max_steps: "4",
  multi_agent_search_limit: "8",
  multi_agent_supervisor_model: "",
  multi_agent_supervisor_temperature: "0.1",
  multi_agent_worker_model: "",
  multi_agent_worker_temperature: "0.3",
  multi_agent_synthesis_model: "",
  multi_agent_synthesis_temperature: "0.4",
};

const AGENT_OPTIONS = [
  ["retrieval", "检索"],
  ["planner", "规划"],
  ["literature_scout", "侦察"],
  ["survey", "综述"],
  ["paper_analyst", "论文解析"],
  ["reproduction", "复现"],
  ["synthesis", "整合"],
] as const;

const ROUTING_MODE_COPY: Record<MultiAgentRoutingMode, { label: string; description: string }> = {
  rule: {
    label: "规则判断",
    description: "按关键词和上下文类型选择 agent，行为稳定、可预期。",
  },
  llm: {
    label: "模型判断",
    description: "理论上由调度模型决定调用哪些 agent，更灵活但也更依赖模型质量。",
  },
  hybrid: {
    label: "混合判断",
    description: "先用规则给出基础方案，再结合模型做补充或修正。",
  },
};

const AGENT_GUIDES = [
  { key: "retrieval", label: "检索", description: "先从本地论文库和知识库中找上下文证据。" },
  { key: "planner", label: "规划", description: "把研究问题拆成学习路径、阶段目标和行动建议。" },
  { key: "literature_scout", label: "侦察", description: "筛选核心论文、代表工作和候选阅读清单。" },
  { key: "survey", label: "综述", description: "围绕主题组织结构化综述，梳理方法、趋势和空白。" },
  { key: "paper_analyst", label: "论文解析", description: "精读单篇论文，提炼方法、实验和局限。" },
  { key: "reproduction", label: "复现", description: "围绕实现细节、训练配置和复现实验给建议。" },
  { key: "synthesis", label: "整合", description: "把前面各个 agent 的结果汇总成最终回答。" },
];

type SaveState = "idle" | "saving" | "saved" | "error";
type TestState = "idle" | "testing" | "ok" | "error";

export default function Settings() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");

  const set = (key: keyof AppSettings) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const loadSettings = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const data = await apiClient.settings.get();
      setForm({ ...DEFAULT_SETTINGS, ...data });
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaveState("saving");
    try {
      await apiClient.settings.update(form);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const handleTestConnection = async () => {
    setTestState("testing");
    setTestMsg("");
    try {
      const reply = await apiClient.settings.test(form);
      setTestState("ok");
      setTestMsg(reply.slice(0, 80));
      setTimeout(() => setTestState("idle"), 4000);
    } catch (error) {
      setTestState("error");
      setTestMsg(formatErrorMessage(error).slice(0, 120));
      setTimeout(() => setTestState("idle"), 5000);
    }
  };

  const provider = form.llm_provider as LlmProvider;
  const routingMode = form.multi_agent_routing_mode as MultiAgentRoutingMode;
  const enabledAgents = form.multi_agent_enabled_agents
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const toggleAgent = (agentName: string) => {
    const next = enabledAgents.includes(agentName)
      ? enabledAgents.filter((item) => item !== agentName)
      : [...enabledAgents, agentName];
    set("multi_agent_enabled_agents")(next.join(","));
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶部固定操作栏 ─────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-nm-dark/10"
        style={{ background: "#EEF1F5" }}
      >
        <div>
          <h1 className="text-lg font-bold text-ink-primary leading-tight">设置</h1>
          <p className="text-xs text-ink-tertiary">配置 AI 服务与运行参数</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 测试连接 */}
          <div className="relative">
            <button
              onClick={handleTestConnection}
              disabled={testState === "testing" || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: testState === "ok"
                  ? "linear-gradient(145deg,#40D466,#28A844)"
                  : testState === "error"
                  ? "linear-gradient(145deg,#FF5555,#CC2200)"
                  : "#E8ECF0",
                color: testState === "ok" || testState === "error" ? "#fff" : "#3C3C43",
                boxShadow: testState === "idle" || testState === "testing"
                  ? "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF"
                  : "none",
              }}
            >
              {testState === "testing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              {testState === "testing" ? "测试中…" : testState === "ok" ? "连接正常" : testState === "error" ? "连接失败" : "测试连接"}
            </button>
            {testMsg && (
              <span className={`absolute top-full left-0 mt-0.5 text-xs whitespace-nowrap ${testState === "error" ? "text-red-500" : "text-green-600"}`}>
                {testMsg.slice(0, 30)}
              </span>
            )}
          </div>
          {/* 保存 */}
          <button
            onClick={handleSaveSettings}
            disabled={saveState === "saving" || loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background: saveState === "saved"
                ? "linear-gradient(145deg,#40D466,#28A844)"
                : saveState === "error"
                ? "linear-gradient(145deg,#FF5555,#CC2200)"
                : "linear-gradient(145deg,#1A8AFF,#0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
            }}
          >
            {saveState === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saveState === "saved" && <CheckCircle className="w-3.5 h-3.5" />}
            {saveState === "error" && <AlertCircle className="w-3.5 h-3.5" />}
            {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已保存" : saveState === "error" ? "保存失败" : "保存"}
          </button>
        </div>
      </div>

      {/* ── 内容区 ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* ── LLM Settings ────────────────────────── */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Brain} color="#AF52DE" />
          <h2 className="text-sm font-semibold text-ink-primary">AI 模型配置</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-ink-tertiary">
            <Loader2 className="w-4 h-4 animate-spin" />
            从后端加载配置…
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 py-4 text-sm text-apple-red">
            <AlertCircle className="w-4 h-4" />
            {loadError}
          </div>
        ) : (
          <>
            {/* Provider selector */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-ink-tertiary ml-1">模型服务商</label>
              <div className="flex gap-2 flex-wrap">
                {(["openai_compatible", "openai", "anthropic"] as LlmProvider[]).map((p) => (
                  <ProviderTab
                    key={p}
                    label={p === "openai_compatible" ? "兼容接口（推荐）" : p === "openai" ? "OpenAI" : "Anthropic"}
                    active={provider === p}
                    onClick={() => set("llm_provider")(p)}
                  />
                ))}
              </div>
            </div>

            {/* OpenAI-Compatible (DashScope, DeepSeek, etc.) */}
            {provider === "openai_compatible" && (
              <div className="space-y-3">
                <SettingInput
                  label="接口地址"
                  value={form.openai_compatible_base_url}
                  onChange={set("openai_compatible_base_url")}
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                  hint="阿里云 DashScope: https://dashscope.aliyuncs.com/compatible-mode/v1"
                />
                <SettingInput
                  label="接口密钥"
                  value={form.openai_compatible_api_key}
                  onChange={set("openai_compatible_api_key")}
                  placeholder="sk-..."
                  sensitive
                  hint="留空或输入 *** 表示不更改"
                />
                <SettingInput
                  label="对话模型"
                  value={form.openai_compatible_chat_model}
                  onChange={set("openai_compatible_chat_model")}
                  placeholder="qwen-plus / deepseek-chat"
                />
              </div>
            )}

            {/* OpenAI */}
            {provider === "openai" && (
              <div className="space-y-3">
                <SettingInput
                  label="接口地址"
                  value={form.openai_base_url}
                  onChange={set("openai_base_url")}
                  placeholder="https://api.openai.com/v1"
                />
                <SettingInput
                  label="接口密钥"
                  value={form.openai_api_key}
                  onChange={set("openai_api_key")}
                  placeholder="sk-..."
                  sensitive
                />
                <SettingInput
                  label="对话模型"
                  value={form.openai_chat_model}
                  onChange={set("openai_chat_model")}
                  placeholder="gpt-4o-mini"
                />
              </div>
            )}

            {/* Anthropic */}
            {provider === "anthropic" && (
              <div className="space-y-3">
                <SettingInput
                  label="接口密钥"
                  value={form.anthropic_api_key}
                  onChange={set("anthropic_api_key")}
                  placeholder="sk-ant-..."
                  sensitive
                />
                <SettingInput
                  label="对话模型"
                  value={form.anthropic_chat_model}
                  onChange={set("anthropic_chat_model")}
                  placeholder="claude-3-5-haiku-20241022"
                />
              </div>
            )}

            {/* External APIs */}
            <div className="space-y-3 pt-1 border-t border-nm-dark/10">
              <p className="text-xs font-medium text-ink-tertiary">外部学术服务</p>
              <SettingInput
                label="Semantic Scholar 接口密钥（可选）"
                value={form.semantic_scholar_api_key}
                onChange={set("semantic_scholar_api_key")}
                placeholder="留空使用免费限速额度"
                sensitive
              />
            </div>
          </>
        )}
      </Card>

      {/* ── Embedding Provider ───────────────────── */}
      {!loading && !loadError && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionIcon icon={Database} color="#5856D6" />
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">独立向量化接口（可选）</h2>
              <p className="text-xs text-ink-tertiary mt-0.5">填写后将使用此接口生成向量，留空则沿用上方 AI 服务的向量模型</p>
            </div>
          </div>
          <div className="space-y-3">
            <SettingInput
              label="向量接口地址"
              value={form.embedding_base_url}
              onChange={set("embedding_base_url")}
              placeholder="https://api.openai.com/v1"
            />
            <SettingInput
              label="向量接口密钥"
              value={form.embedding_api_key}
              onChange={set("embedding_api_key")}
              placeholder="sk-..."
              sensitive
              hint="留空或输入 *** 表示不更改"
            />
            <SettingInput
              label="向量模型"
              value={form.embedding_model}
              onChange={set("embedding_model")}
              placeholder="text-embedding-3-small"
              hint="留空将使用默认模型 text-embedding-3-small"
            />
          </div>
        </Card>
      )}

      {/* ── RAG Settings ─────────────────────────── */}
      {!loading && !loadError && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionIcon icon={Database} color="#FF9500" />
            <h2 className="text-sm font-semibold text-ink-primary">向量检索（RAG）</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SettingInput
              label="分块大小（Token）"
              value={form.chunk_size}
              onChange={set("chunk_size")}
              placeholder="800"
            />
            <SettingInput
              label="重叠大小（Token）"
              value={form.chunk_overlap}
              onChange={set("chunk_overlap")}
              placeholder="150"
            />
            <SettingInput
              label="检索数量上限"
              value={form.rag_top_k}
              onChange={set("rag_top_k")}
              placeholder="5"
            />
          </div>
        </Card>
      )}

      {/* ── Multi-Agent Settings ───────────────────── */}
      {!loading && !loadError && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionIcon icon={Bot} color="#34C759" />
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">多 Agent 编排</h2>
              <p className="text-xs text-ink-tertiary mt-0.5">控制调度 agent、执行 agent 和整合 agent 的协同行为</p>
            </div>
          </div>

          <div
            className="rounded-3xl px-4 py-4 flex items-center justify-between gap-4"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink-primary">启用多 agent 编排</div>
              <div className="text-xs text-ink-tertiary mt-1">关闭后仅保留最终回答，不再展示中间拆解链路</div>
            </div>
            <button
              onClick={() => set("multi_agent_enabled")(form.multi_agent_enabled === "true" ? "false" : "true")}
              className="w-16 h-9 rounded-full relative transition-colors flex-shrink-0 overflow-hidden"
              style={{ background: form.multi_agent_enabled === "true" ? "#34C759" : "#C8CDD3" }}
            >
              <span
                className="absolute left-1 top-1 h-7 w-7 rounded-full bg-white transition-transform"
                style={{
                  transform: form.multi_agent_enabled === "true" ? "translateX(28px)" : "translateX(0)",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                }}
              />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-tertiary ml-1">选路方式</label>
            <div className="flex gap-2 flex-wrap">
              {([
                ["rule", "规则判断"],
                ["llm", "模型判断"],
                ["hybrid", "混合判断"],
              ] as const).map(([value, label]) => (
                <ProviderTab
                  key={value}
                  label={label}
                  active={routingMode === value}
                  onClick={() => set("multi_agent_routing_mode")(value)}
                />
              ))}
            </div>
            <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
              <p className="text-sm font-semibold text-ink-primary">{ROUTING_MODE_COPY[routingMode].label}</p>
              <p className="mt-1 text-xs leading-5 text-ink-secondary">
                {ROUTING_MODE_COPY[routingMode].description}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-ink-tertiary">
                当前桌面端仍以规则判断为主，这一项已预留给后续更细的模型选路能力，因此你现在切换模式，主要影响配置展示和后续兼容。
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-tertiary ml-1">启用的专项 agent</label>
            <div className="flex gap-2 flex-wrap">
              {AGENT_OPTIONS.map(([value, label]) => (
                <AgentChip
                  key={value}
                  label={label}
                  active={enabledAgents.includes(value)}
                  onClick={() => toggleAgent(value)}
                />
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {AGENT_GUIDES.map((item) => (
                <div key={item.key} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-3 py-2.5">
                  <p className="text-xs font-semibold text-ink-primary">{item.label}</p>
                  <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SettingInput
              label="单次最多调用的专项 agent 数"
              value={form.multi_agent_max_steps}
              onChange={set("multi_agent_max_steps")}
              placeholder="4"
            />
            <SettingInput
              label="单次检索条数上限"
              value={form.multi_agent_search_limit}
              onChange={set("multi_agent_search_limit")}
              placeholder="8"
            />
            <SettingInput
              label="调度模型"
              value={form.multi_agent_supervisor_model}
              onChange={set("multi_agent_supervisor_model")}
              placeholder="留空沿用主模型"
            />
            <SettingInput
              label="调度温度"
              value={form.multi_agent_supervisor_temperature}
              onChange={set("multi_agent_supervisor_temperature")}
              placeholder="0.1"
            />
            <SettingInput
              label="执行模型"
              value={form.multi_agent_worker_model}
              onChange={set("multi_agent_worker_model")}
              placeholder="留空沿用主模型"
            />
            <SettingInput
              label="执行温度"
              value={form.multi_agent_worker_temperature}
              onChange={set("multi_agent_worker_temperature")}
              placeholder="0.3"
            />
            <SettingInput
              label="整合模型"
              value={form.multi_agent_synthesis_model}
              onChange={set("multi_agent_synthesis_model")}
              placeholder="留空沿用主模型"
            />
            <SettingInput
              label="整合温度"
              value={form.multi_agent_synthesis_temperature}
              onChange={set("multi_agent_synthesis_temperature")}
              placeholder="0.4"
            />
          </div>
        </Card>
      )}

      {/* ── About ───────────────────────────────── */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Info} color="#5AC8FA" />
          <h2 className="text-sm font-semibold text-ink-primary">关于</h2>
        </div>
        <div className="space-y-2 ml-12">
          {[
            ["应用", "智研 Copilot 桌面端 v0.2.1"],
            ["技术栈", "Tauri v2 · React · Rust · 多 agent 协同"],
            ["存储", "SQLite（本地嵌入式）"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-xs text-ink-tertiary">{k}</span>
              <span className="text-xs font-medium text-ink-secondary">{v}</span>
            </div>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
}
