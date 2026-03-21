import { useState, useEffect, type ComponentType } from "react";
import { Brain, Database, Info, Eye, EyeOff, CheckCircle, Loader2, AlertCircle, Bot } from "lucide-react";
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

type SaveState = "idle" | "saving" | "saved" | "error";

export default function Settings() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

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
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">设置</h1>
        <p className="text-sm text-ink-tertiary mt-0.5">配置后端连接和 AI 服务</p>
      </div>

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
              <label className="block text-xs font-medium text-ink-tertiary ml-1">LLM 服务商</label>
              <div className="flex gap-2 flex-wrap">
                {(["openai_compatible", "openai", "anthropic"] as LlmProvider[]).map((p) => (
                  <ProviderTab
                    key={p}
                    label={p === "openai_compatible" ? "兼容接口 (推荐)" : p === "openai" ? "OpenAI" : "Anthropic"}
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
                  label="API Base URL"
                  value={form.openai_compatible_base_url}
                  onChange={set("openai_compatible_base_url")}
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                  hint="阿里云 DashScope: https://dashscope.aliyuncs.com/compatible-mode/v1"
                />
                <SettingInput
                  label="API Key"
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
                <SettingInput
                  label="Embedding 模型"
                  value={form.openai_compatible_embedding_model}
                  onChange={set("openai_compatible_embedding_model")}
                  placeholder="text-embedding-v3"
                />
              </div>
            )}

            {/* OpenAI */}
            {provider === "openai" && (
              <div className="space-y-3">
                <SettingInput
                  label="API Base URL"
                  value={form.openai_base_url}
                  onChange={set("openai_base_url")}
                  placeholder="https://api.openai.com/v1"
                />
                <SettingInput
                  label="API Key"
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
                <SettingInput
                  label="Embedding 模型"
                  value={form.openai_embedding_model}
                  onChange={set("openai_embedding_model")}
                  placeholder="text-embedding-3-small"
                />
              </div>
            )}

            {/* Anthropic */}
            {provider === "anthropic" && (
              <div className="space-y-3">
                <SettingInput
                  label="API Key"
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
              <p className="text-xs font-medium text-ink-tertiary">外部服务</p>
              <SettingInput
                label="Semantic Scholar API Key（可选）"
                value={form.semantic_scholar_api_key}
                onChange={set("semantic_scholar_api_key")}
                placeholder="留空使用免费限速额度"
                sensitive
              />
            </div>
          </>
        )}
      </Card>

      {/* ── RAG Settings ─────────────────────────── */}
      {!loading && !loadError && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionIcon icon={Database} color="#FF9500" />
            <h2 className="text-sm font-semibold text-ink-primary">向量检索（RAG）</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SettingInput
              label="分块大小（tokens）"
              value={form.chunk_size}
              onChange={set("chunk_size")}
              placeholder="800"
            />
            <SettingInput
              label="重叠大小（tokens）"
              value={form.chunk_overlap}
              onChange={set("chunk_overlap")}
              placeholder="150"
            />
            <SettingInput
              label="检索 Top-K"
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
              <p className="text-xs text-ink-tertiary mt-0.5">控制 supervisor、worker 和 synthesis 的路由行为</p>
            </div>
          </div>

          <div
            className="rounded-3xl px-4 py-4 flex items-center justify-between gap-4"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
            }}
          >
            <div>
              <div className="text-sm font-semibold text-ink-primary">启用 Multi-Agent</div>
              <div className="text-xs text-ink-tertiary mt-1">关闭后只保留最终回答能力，不再展示 supervisor 拆解链路</div>
            </div>
            <button
              onClick={() => set("multi_agent_enabled")(form.multi_agent_enabled === "true" ? "false" : "true")}
              className="w-16 h-9 rounded-full relative transition-colors"
              style={{ background: form.multi_agent_enabled === "true" ? "#34C759" : "#C8CDD3" }}
            >
              <span
                className="absolute top-1 h-7 w-7 rounded-full bg-white transition-transform"
                style={{
                  transform: form.multi_agent_enabled === "true" ? "translateX(32px)" : "translateX(4px)",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                }}
              />
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-tertiary ml-1">路由模式</label>
            <div className="flex gap-2 flex-wrap">
              {([
                ["rule", "规则优先"],
                ["llm", "LLM 路由"],
                ["hybrid", "混合模式"],
              ] as const).map(([value, label]) => (
                <ProviderTab
                  key={value}
                  label={label}
                  active={routingMode === value}
                  onClick={() => set("multi_agent_routing_mode")(value)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-tertiary ml-1">启用的 Specialist</label>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SettingInput
              label="最大步骤数"
              value={form.multi_agent_max_steps}
              onChange={set("multi_agent_max_steps")}
              placeholder="4"
            />
            <SettingInput
              label="检索上限"
              value={form.multi_agent_search_limit}
              onChange={set("multi_agent_search_limit")}
              placeholder="8"
            />
            <SettingInput
              label="Supervisor 模型"
              value={form.multi_agent_supervisor_model}
              onChange={set("multi_agent_supervisor_model")}
              placeholder="留空沿用主模型"
            />
            <SettingInput
              label="Supervisor Temperature"
              value={form.multi_agent_supervisor_temperature}
              onChange={set("multi_agent_supervisor_temperature")}
              placeholder="0.1"
            />
            <SettingInput
              label="Worker 模型"
              value={form.multi_agent_worker_model}
              onChange={set("multi_agent_worker_model")}
              placeholder="留空沿用主模型"
            />
            <SettingInput
              label="Worker Temperature"
              value={form.multi_agent_worker_temperature}
              onChange={set("multi_agent_worker_temperature")}
              placeholder="0.3"
            />
            <SettingInput
              label="Synthesis 模型"
              value={form.multi_agent_synthesis_model}
              onChange={set("multi_agent_synthesis_model")}
              placeholder="留空沿用主模型"
            />
            <SettingInput
              label="Synthesis Temperature"
              value={form.multi_agent_synthesis_temperature}
              onChange={set("multi_agent_synthesis_temperature")}
              placeholder="0.4"
            />
          </div>
        </Card>
      )}

      {/* ── Save Button ──────────────────────────── */}
      {!loading && !loadError && (
        <button
          onClick={handleSaveSettings}
          disabled={saveState === "saving"}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.99] disabled:opacity-60"
          style={{
            background:
              saveState === "saved"
                ? "linear-gradient(145deg, #40D466, #28A844)"
                : saveState === "error"
                ? "linear-gradient(145deg, #FF5555, #CC2200)"
                : "linear-gradient(145deg, #1A8AFF, #0062CC)",
            boxShadow:
              saveState === "saved"
                ? "4px 4px 10px rgba(0,140,0,0.35), -3px -3px 8px rgba(80,220,100,0.2)"
                : "4px 4px 10px rgba(0,62,204,0.35), -3px -3px 8px rgba(58,155,255,0.2)",
          }}
        >
          {saveState === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveState === "saved" && <CheckCircle className="w-4 h-4" />}
          {saveState === "error" && <AlertCircle className="w-4 h-4" />}
          {saveState === "saving" ? "保存中…"
            : saveState === "saved" ? "已保存"
            : saveState === "error" ? "保存失败，请重试"
            : "保存所有设置"}
        </button>
      )}

      {/* ── About ───────────────────────────────── */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Info} color="#5AC8FA" />
          <h2 className="text-sm font-semibold text-ink-primary">关于</h2>
        </div>
        <div className="space-y-2 ml-12">
          {[
            ["应用", "智研 Copilot Desktop v0.2.0"],
            ["技术栈", "Tauri v2 · React · Rust · Multi-Agent"],
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
  );
}
