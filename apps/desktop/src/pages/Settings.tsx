import { useState, useEffect, type ComponentType } from "react";
import { Server, Brain, Database, Info, Eye, EyeOff, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { apiClient } from "../lib/client";
import type { AppSettings, LlmProvider } from "@research-copilot/types";

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
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function Settings() {
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem("api_url") ?? import.meta.env.VITE_API_URL ?? "http://localhost:8008"
  );
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const set = (key: keyof AppSettings) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    apiClient.settings
      .get()
      .then((data) => setForm({ ...DEFAULT_SETTINGS, ...data }))
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveApiUrl = () => {
    localStorage.setItem("api_url", apiUrl);
  };

  const handleSaveSettings = async () => {
    setSaveState("saving");
    try {
      await apiClient.settings.update(form);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const provider = form.llm_provider as LlmProvider;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">设置</h1>
        <p className="text-sm text-ink-tertiary mt-0.5">配置后端连接和 AI 服务</p>
      </div>

      {/* ── Backend Connection ────────────────────── */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Server} color="#007AFF" />
          <h2 className="text-sm font-semibold text-ink-primary">后端连接</h2>
        </div>

        <SettingInput
          label="API 地址"
          value={apiUrl}
          onChange={setApiUrl}
          placeholder="http://localhost:8008"
        />

        <button
          onClick={handleSaveApiUrl}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium text-white transition-all duration-150 active:scale-95"
          style={{
            background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
            boxShadow: "4px 4px 10px rgba(0,62,204,0.35), -3px -3px 8px rgba(58,155,255,0.2)",
          }}
        >
          保存地址
        </button>
      </Card>

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
            {loadError} — 请先确认后端已启动
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
            ["应用", "智研 Copilot Desktop v0.1.0"],
            ["技术栈", "Tauri v2 · React · FastAPI · pgvector"],
            ["存储", "PostgreSQL + pgvector"],
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
