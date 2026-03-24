import { useEffect, useMemo, useState, type ComponentType } from "react";
import changelogRaw from "../../../../CHANGELOG.md?raw";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  AlertCircle,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Compass,
  Database,
  Download,
  Eye,
  EyeOff,
  FileSearch,
  Hammer,
  Info,
  LayoutDashboard,
  Loader2,
  Layers3,
  MessageSquare,
  RefreshCw,
  Route,
  Search,
  Sparkles,
  Wifi,
} from "lucide-react";
import { Card } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../lib/client";
import { DEFAULT_PAPER_TAG_VISIBILITY_VALUE, PAPER_TAG_OPTIONS, parsePaperTagVisibility, togglePaperTagVisibility } from "../lib/paperTags";
import { getLayoutMode, setLayoutMode, type LayoutMode } from "../lib/layoutMode";
import type { AppSettings, AppUpdateInfo, LlmProvider, MultiAgentRoutingMode } from "@research-copilot/types";

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
  onChange: (value: string) => void;
  placeholder?: string;
  sensitive?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const type = sensitive && !show ? "password" : "text";

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-ink-tertiary ml-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 transition-shadow duration-150 pr-10"
          style={{
            background: "#E8ECF0",
            boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
          }}
          onFocus={(event) => {
            event.currentTarget.style.boxShadow =
              "inset 3px 3px 7px #C0C5CB, inset -3px -3px 7px #FFFFFF, 0 0 0 2px rgba(0,122,255,0.2)";
          }}
          onBlur={(event) => {
            event.currentTarget.style.boxShadow =
              "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF";
          }}
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow((state) => !state)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint ? <p className="text-xs text-ink-tertiary ml-1 leading-5">{hint}</p> : null}
    </div>
  );
}

function parseChangelog(raw: string) {
  const versions: { version: string; sections: { label: string; items: string[] }[] }[] = [];
  let current: (typeof versions)[number] | null = null;
  let currentSection: { label: string; items: string[] } | null = null;

  for (const line of raw.split("\n")) {
    const versionMatch = line.match(/^## \[(.+?)\]/);
    if (versionMatch) {
      if (currentSection && current) current.sections.push(currentSection);
      if (current) versions.push(current);
      current = { version: versionMatch[1], sections: [] };
      currentSection = null;
      continue;
    }
    const sectionMatch = line.match(/^### (.+)/);
    if (sectionMatch && current) {
      if (currentSection) current.sections.push(currentSection);
      currentSection = { label: sectionMatch[1], items: [] };
      continue;
    }
    const itemMatch = line.match(/^- (.+)/);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1]);
    }
  }
  if (currentSection && current) current.sections.push(currentSection);
  if (current) versions.push(current);
  return versions;
}

function normalizeVersionTag(version?: string) {
  return (version ?? "").trim().replace(/^v/i, "");
}

function getChangelogReleaseDate(raw: string, version?: string) {
  const target = normalizeVersionTag(version);
  if (!target) {
    return "";
  }

  for (const line of raw.split("\n")) {
    const match = line.match(/^## \[(.+?)\](?: - (\d{4}-\d{2}-\d{2}))?/);
    if (!match) {
      continue;
    }

    const changelogVersion = normalizeVersionTag(match[1]);
    if (changelogVersion === target) {
      return match[2] ?? "";
    }
  }

  return "";
}

function ChangelogCard() {
  const versions = useMemo(() => parseChangelog(changelogRaw), []);
  const [expanded, setExpanded] = useState<string | null>(versions[0]?.version ?? null);

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center gap-3">
        <SectionIcon icon={RefreshCw} color="#34C759" />
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">更新日志</h2>
          <p className="text-xs text-ink-tertiary mt-0.5">各版本功能变更记录</p>
        </div>
      </div>
      <div className="space-y-2">
        {versions.map(({ version, sections }) => {
          const isOpen = expanded === version;
          return (
            <div key={version} className="overflow-hidden rounded-2xl border border-nm-dark/10 bg-white/30">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : version)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/20"
              >
                <span className="text-sm font-semibold text-ink-primary">
                  {version === "未发布" ? "开发中" : `v${version}`}
                </span>
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0 text-ink-tertiary transition-transform duration-150"
                  style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                  viewBox="0 0 12 12" fill="none"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isOpen && (
                <div className="border-t border-nm-dark/10 px-4 pb-4 pt-3 space-y-3">
                  {sections.map(({ label, items }) => (
                    <div key={label}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
                      <ul className="space-y-1">
                        {items.map((item, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-5 text-ink-secondary">
                            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-ink-tertiary/50" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
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
      type="button"
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

function SectionIcon({
  icon: Icon,
  color,
}: {
  icon: ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{
        background: "#E8ECF0",
        boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
        color,
      }}
    >
      <Icon className="w-4.5 h-4.5" />
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
      type="button"
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

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-3xl px-4 py-4 flex items-center justify-between gap-4"
      style={{
        background: "#E8ECF0",
        boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-primary">{title}</div>
        <div className="text-xs text-ink-tertiary mt-1 leading-5">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="w-16 h-9 rounded-full relative transition-colors flex-shrink-0 overflow-hidden"
        style={{ background: checked ? "#34C759" : "#C8CDD3" }}
      >
        <span
          className="absolute left-1 top-1 h-7 w-7 rounded-full bg-white transition-transform"
          style={{
            transform: checked ? "translateX(28px)" : "translateX(0)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          }}
        />
      </button>
    </div>
  );
}

type SettingsSectionKey = "connection" | "paper_tags" | "roles" | "agents" | "about" | "layout";

const SETTINGS_SECTIONS: Array<{
  key: SettingsSectionKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    key: "connection",
    label: "连接与检索",
    description: "服务商与默认基座",
    icon: Brain,
    color: "#AF52DE",
  },
  {
    key: "roles",
    label: "模型分工",
    description: "按特征分配专属模型",
    icon: Sparkles,
    color: "#0A84FF",
  },
  {
    key: "agents",
    label: "多 Agent",
    description: "编排模式与并发限制",
    icon: Bot,
    color: "#34C759",
  },
  {
    key: "paper_tags",
    label: "论文库",
    description: "管理论文显示与导入",
    icon: Layers3,
    color: "#FF9F0A",
  },
  {
    key: "layout",
    label: "界面布局",
    description: "功能入口与界面形态",
    icon: LayoutDashboard,
    color: "#30B0C7",
  },
  {
    key: "about",
    label: "系统信息",
    description: "查看版本与升级",
    icon: Info,
    color: "#5AC8FA",
  },
];

function SettingsSectionTab({
  icon: Icon,
  color,
  label,
  description,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  color: string;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[28px] p-4 text-left transition-all duration-150"
      style={
        active
          ? {
              background: "linear-gradient(145deg, rgba(26,138,255,0.12), rgba(255,255,255,0.92))",
              boxShadow: "6px 6px 16px rgba(183,190,199,0.8), -6px -6px 16px rgba(255,255,255,0.95)",
            }
          : {
              background: "#EEF1F5",
              boxShadow: "5px 5px 14px #CBD0D7, -5px -5px 14px #FFFFFF",
            }
      }
    >
      <div className="flex items-start gap-3">
        <SectionIcon icon={Icon} color={color} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-primary">{label}</p>
          <p className="mt-1 text-xs leading-5 text-ink-tertiary">{description}</p>
        </div>
      </div>
    </button>
  );
}

function RecommendationList({ items }: { items: string[] }) {
  return (
    <div
      className="rounded-3xl px-4 py-4 space-y-2"
      style={{
        background: "linear-gradient(145deg, rgba(26,138,255,0.08), rgba(255,255,255,0.75))",
        boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.75), 0 12px 24px rgba(15,23,42,0.05)",
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#1A8AFF]" />
        <p className="text-sm font-semibold text-ink-primary">配置建议</p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={item} className="text-xs leading-5 text-ink-secondary">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}





type GroupedModelDefinition = {
  title: string;
  description: string;
  recommendation: string;
  affectedScopes: string;
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  modelKeys: (keyof AppSettings)[];
  temperatureKeys: (keyof AppSettings)[];
  baseUrlKeys: (keyof AppSettings)[];
  apiKeyKeys: (keyof AppSettings)[];
  modelPlaceholder: string;
  temperaturePlaceholder: string;
};

function GroupedModelCard({
  icon: Icon,
  iconColor,
  title,
  description,
  recommendation,
  affectedScopes,
  modelValue,
  temperatureValue,
  baseUrlValue,
  apiKeyValue,
  mixedBaseUrl,
  mixedApiKey,
  onModelChange,
  onTemperatureChange,
  onBaseUrlChange,
  onApiKeyChange,
  modelPlaceholder,
  temperaturePlaceholder,
}: {
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  recommendation: string;
  affectedScopes: string;
  modelValue: string;
  temperatureValue: string;
  baseUrlValue: string;
  apiKeyValue: string;
  mixedBaseUrl: boolean;
  mixedApiKey: boolean;
  onModelChange: (value: string) => void;
  onTemperatureChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  modelPlaceholder: string;
  temperaturePlaceholder: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div
      className="rounded-[28px] p-4 space-y-4"
      style={{
        background: "#EEF1F5",
        boxShadow: "6px 6px 16px #CBD0D7, -6px -6px 16px #FFFFFF",
      }}
    >
      <div className="flex items-start gap-3">
        <SectionIcon icon={Icon} color={iconColor} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-primary">{title}</p>
          <p className="text-xs text-ink-tertiary mt-1 leading-5">{description}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3 space-y-2">
        <p className="text-[11px] font-semibold tracking-wide text-ink-secondary">适用范围</p>
        <p className="text-xs leading-5 text-ink-secondary">{affectedScopes}</p>
        <p className="text-[11px] leading-5 text-ink-tertiary">{recommendation}</p>
      </div>
      <div className="grid gap-3">
        <SettingInput
          label="统一模型"
          value={modelValue}
          onChange={onModelChange}
          placeholder={modelPlaceholder}
          hint="留空表示继续按主模型或高级设置中的细分配置继承。"
        />
        <SettingInput
          label="统一温度"
          value={temperatureValue}
          onChange={onTemperatureChange}
          placeholder={temperaturePlaceholder}
          hint="留空表示继续沿用各自已有温度；重新填写会统一覆盖这一组。"
        />
      </div>
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-ink-tertiary hover:text-ink-secondary transition-colors"
      >
        {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {showAdvanced ? "收起独立接口配置" : "展开独立接口配置（Base URL / API Key）"}
      </button>
      {showAdvanced ? (
        <div className="grid gap-3 pt-1 border-t border-nm-dark/10">
          {(mixedBaseUrl || mixedApiKey) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
              <p className="text-xs leading-5 text-amber-800">
                这组内已有不同的接口地址或密钥。重新填写将统一覆盖这一组所有场景。
              </p>
            </div>
          ) : null}
          <SettingInput
            label="接口地址（留空继承主服务商）"
            value={baseUrlValue}
            onChange={onBaseUrlChange}
            placeholder="https://api.example.com/v1"
            hint="为这一组场景单独指定接口地址，例如猎犬场景可接入支持联网的服务商。"
          />
          <SettingInput
            label="接口密钥（留空继承主服务商）"
            value={apiKeyValue}
            onChange={onApiKeyChange}
            placeholder="sk-..."
            sensitive
            hint={`留空或输入 ${MASK} 表示不更改`}
          />
        </div>
      ) : null}
    </div>
  );
}

const MASK = "***";

const PROVIDER_PRESETS = [
  {
    id: "openai",
    label: "OpenAI",
    emoji: "🔮",
    providerType: "openai" as LlmProvider,
    baseUrl: undefined as string | undefined,
    defaultChatModel: "",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-...",
    note: "需要梯子或转发",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    emoji: "🌀",
    providerType: "anthropic" as LlmProvider,
    baseUrl: undefined as string | undefined,
    defaultChatModel: "",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-ant-...",
    note: "需要梯子或转发",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    emoji: "🐳",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://api.deepseek.com/v1",
    defaultChatModel: "deepseek-chat",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-...",
  },
  {
    id: "qwen",
    label: "通义千问",
    emoji: "🌊",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultChatModel: "qwen-plus",
    defaultEmbedModel: "text-embedding-v3",
    apiKeyPlaceholder: "sk-...",
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    emoji: "💎",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultChatModel: "Qwen/Qwen2.5-72B-Instruct",
    defaultEmbedModel: "BAAI/bge-m3",
    apiKeyPlaceholder: "sk-...",
  },
  {
    id: "moonshot",
    label: "Moonshot",
    emoji: "🌙",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://api.moonshot.cn/v1",
    defaultChatModel: "moonshot-v1-8k",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-...",
  },
  {
    id: "gemini",
    label: "Gemini",
    emoji: "✨",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultChatModel: "gemini-2.0-flash",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "AIza...",
  },
  {
    id: "ollama",
    label: "Ollama",
    emoji: "🦙",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "http://localhost:11434/v1",
    defaultChatModel: "qwen2.5:7b",
    defaultEmbedModel: "nomic-embed-text",
    apiKeyPlaceholder: "ollama",
    note: "本地部署，无需 Key",
  },
  {
    id: "custom",
    label: "自定义",
    emoji: "⚙️",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "",
    defaultChatModel: "",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-...",
  },
] as const;

type ProviderPresetId = (typeof PROVIDER_PRESETS)[number]["id"];

function detectPreset(form: AppSettings): ProviderPresetId {
  if (form.llm_provider === "openai") return "openai";
  if (form.llm_provider === "anthropic") return "anthropic";
  const url = form.openai_compatible_base_url.trim();
  if (url.includes("deepseek.com")) return "deepseek";
  if (url.includes("dashscope.aliyuncs.com")) return "qwen";
  if (url.includes("siliconflow.cn")) return "siliconflow";
  if (url.includes("moonshot.cn")) return "moonshot";
  if (url.includes("generativelanguage.googleapis.com")) return "gemini";
  if (url.includes("localhost:11434") || url.includes("127.0.0.1:11434")) return "ollama";
  return "custom";
}

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
  planner_hint_base_url: "",
  planner_hint_api_key: "",
  planner_hint_temperature: "0.2",
  planner_hint_top_p: "",
  planner_hint_max_tokens: "",
  planner_hint_presence_penalty: "",
  planner_hint_frequency_penalty: "",
  planner_analysis_model: "",
  planner_analysis_base_url: "",
  planner_analysis_api_key: "",
  planner_analysis_temperature: "0.2",
  planner_analysis_top_p: "",
  planner_analysis_max_tokens: "",
  planner_analysis_presence_penalty: "",
  planner_analysis_frequency_penalty: "",
  planner_generation_model: "",
  planner_generation_base_url: "",
  planner_generation_api_key: "",
  planner_generation_temperature: "0.3",
  planner_generation_top_p: "",
  planner_generation_max_tokens: "",
  planner_generation_presence_penalty: "",
  planner_generation_frequency_penalty: "",
  survey_planner_model: "",
  survey_planner_base_url: "",
  survey_planner_api_key: "",
  survey_planner_temperature: "0.2",
  survey_planner_top_p: "",
  survey_planner_max_tokens: "",
  survey_planner_presence_penalty: "",
  survey_planner_frequency_penalty: "",
  survey_writer_model: "",
  survey_writer_base_url: "",
  survey_writer_api_key: "",
  survey_writer_temperature: "0.3",
  survey_writer_top_p: "",
  survey_writer_max_tokens: "",
  survey_writer_presence_penalty: "",
  survey_writer_frequency_penalty: "",
  paper_analysis_model: "",
  paper_analysis_base_url: "",
  paper_analysis_api_key: "",
  paper_analysis_temperature: "0.3",
  paper_analysis_top_p: "",
  paper_analysis_max_tokens: "",
  paper_analysis_presence_penalty: "",
  paper_analysis_frequency_penalty: "",
  paper_reproduction_model: "",
  paper_reproduction_base_url: "",
  paper_reproduction_api_key: "",
  paper_reproduction_temperature: "0.25",
  paper_reproduction_top_p: "",
  paper_reproduction_max_tokens: "",
  paper_reproduction_presence_penalty: "",
  paper_reproduction_frequency_penalty: "",
  copilot_simple_model: "",
  copilot_simple_base_url: "",
  copilot_simple_api_key: "",
  copilot_simple_temperature: "0.4",
  copilot_simple_top_p: "",
  copilot_simple_max_tokens: "",
  copilot_simple_presence_penalty: "",
  copilot_simple_frequency_penalty: "",
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
  multi_agent_supervisor_max_tokens: "",
  multi_agent_supervisor_presence_penalty: "",
  multi_agent_supervisor_frequency_penalty: "",
  multi_agent_worker_model: "",
  multi_agent_worker_base_url: "",
  multi_agent_worker_api_key: "",
  multi_agent_worker_temperature: "0.3",
  multi_agent_worker_top_p: "",
  multi_agent_worker_max_tokens: "",
  multi_agent_worker_presence_penalty: "",
  multi_agent_worker_frequency_penalty: "",
  multi_agent_planner_model: "",
  multi_agent_planner_base_url: "",
  multi_agent_planner_api_key: "",
  multi_agent_planner_temperature: "",
  multi_agent_planner_top_p: "",
  multi_agent_planner_max_tokens: "",
  multi_agent_planner_presence_penalty: "",
  multi_agent_planner_frequency_penalty: "",
  multi_agent_literature_scout_model: "",
  multi_agent_literature_scout_base_url: "",
  multi_agent_literature_scout_api_key: "",
  multi_agent_literature_scout_temperature: "",
  multi_agent_literature_scout_top_p: "",
  multi_agent_literature_scout_max_tokens: "",
  multi_agent_literature_scout_presence_penalty: "",
  multi_agent_literature_scout_frequency_penalty: "",
  multi_agent_survey_model: "",
  multi_agent_survey_base_url: "",
  multi_agent_survey_api_key: "",
  multi_agent_survey_temperature: "",
  multi_agent_survey_top_p: "",
  multi_agent_survey_max_tokens: "",
  multi_agent_survey_presence_penalty: "",
  multi_agent_survey_frequency_penalty: "",
  multi_agent_paper_analyst_model: "",
  multi_agent_paper_analyst_base_url: "",
  multi_agent_paper_analyst_api_key: "",
  multi_agent_paper_analyst_temperature: "",
  multi_agent_paper_analyst_top_p: "",
  multi_agent_paper_analyst_max_tokens: "",
  multi_agent_paper_analyst_presence_penalty: "",
  multi_agent_paper_analyst_frequency_penalty: "",
  multi_agent_reproduction_model: "",
  multi_agent_reproduction_base_url: "",
  multi_agent_reproduction_api_key: "",
  multi_agent_reproduction_temperature: "",
  multi_agent_reproduction_top_p: "",
  multi_agent_reproduction_max_tokens: "",
  multi_agent_reproduction_presence_penalty: "",
  multi_agent_reproduction_frequency_penalty: "",
  multi_agent_synthesis_model: "",
  multi_agent_synthesis_base_url: "",
  multi_agent_synthesis_api_key: "",
  multi_agent_synthesis_temperature: "0.4",
  multi_agent_synthesis_top_p: "",
  multi_agent_synthesis_max_tokens: "",
  multi_agent_synthesis_presence_penalty: "",
  multi_agent_synthesis_frequency_penalty: "",
  paper_visible_venue_tags: DEFAULT_PAPER_TAG_VISIBILITY_VALUE,
  paper_auto_rename_on_import: "false",
  paper_auto_rename_rule: "{first_author} - {title} ({year})",
  vision_model: "",
  vision_base_url: "",
  vision_api_key: "",
  vision_temperature: "0.2",
  vision_top_p: "",
  vision_max_tokens: "",
  vision_presence_penalty: "",
  vision_frequency_penalty: "",
  translation_model: "",
  translation_base_url: "",
  translation_api_key: "",
  translation_temperature: "0.1",
  translation_top_p: "",
  translation_max_tokens: "",
  translation_presence_penalty: "",
  translation_frequency_penalty: "",
};

const AGENT_OPTIONS = [
  ["retrieval", "检索"],
  ["planner", "研究规划"],
  ["literature_scout", "文献侦察"],
  ["survey", "综述组织"],
  ["paper_analyst", "论文解析"],
  ["reproduction", "复现建议"],
  ["synthesis", "最终整合"],
] as const;

const ROUTING_MODE_COPY: Record<MultiAgentRoutingMode, { label: string; description: string; note: string }> = {
  rule: {
    label: "规则判断",
    description: "根据关键词和上下文类型固定选择 Agent，最稳定，也最容易复现。",
    note: "这一模式不会调用调度模型，适合你想严格控制成本和行为边界时使用。",
  },
  llm: {
    label: "模型判断",
    description: "由调度模型实时决定该启用哪些 Agent，更灵活，也更依赖模型本身。",
    note: "适合复杂提问和开放式任务。建议给调度模型配置快一些、判断力强一些的模型。",
  },
  hybrid: {
    label: "混合判断",
    description: "先用规则确定基础班底，再由调度模型补充和重排，兼顾稳定性和灵活性。",
    note: "这是当前最推荐的模式。研究路线、选题调研这类复合任务会保留关键 Agent，再由模型补充额外角色。",
  },
};

const AGENT_GUIDES = [
  { key: "retrieval", label: "检索", description: "先从知识库和论文库找证据，适合需要依据的问题。" },
  { key: "planner", label: "研究规划", description: "拆解研究主题、学习路径和阶段目标。" },
  { key: "literature_scout", label: "文献侦察", description: "先找代表性论文、研究脉络和阅读入口。" },
  { key: "survey", label: "综述组织", description: "把线索整理成结构化综述和趋势判断。" },
  { key: "paper_analyst", label: "论文解析", description: "聚焦单篇论文的方法、实验和局限。" },
  { key: "reproduction", label: "复现建议", description: "聚焦实现细节、实验配置和复现风险。" },
  { key: "synthesis", label: "最终整合", description: "把各专项 Agent 的结果整合成最终回答。" },
];




const CHARACTERISTIC_MODEL_CARDS: GroupedModelDefinition[] = [
  {
    title: "流光 · 快速响应",
    description: "反应极快，负责方向提示和小妍日常轻量对话。",
    recommendation: "优先选低延迟、低成本的快模型，用量最大，对速度要求最高。",
    affectedScopes: "方向提示（planner_hint）、小妍轻量对话（copilot_simple）",
    icon: Sparkles,
    iconColor: "#0A84FF",
    modelKeys: [
      "planner_hint_model",
      "copilot_simple_model",
    ],
    temperatureKeys: [
      "planner_hint_temperature",
      "copilot_simple_temperature",
    ],
    baseUrlKeys: [
      "planner_hint_base_url",
      "copilot_simple_base_url",
    ],
    apiKeyKeys: [
      "planner_hint_api_key",
      "copilot_simple_api_key",
    ],
    modelPlaceholder: "例如：qwen-turbo / gpt-4.1-mini",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "元枢 · 默认执行",
    description: "各方面能力均衡，作为所有专项任务的默认执行基座。",
    recommendation: "没有单独指定时，多 Agent 工作节点默认回退到这里，选一个稳定均衡的主力模型即可。",
    affectedScopes: "多 Agent 通用工作节点（worker）",
    icon: Compass,
    iconColor: "#34C759",
    modelKeys: [
      "multi_agent_worker_model",
    ],
    temperatureKeys: [
      "multi_agent_worker_temperature",
    ],
    baseUrlKeys: [
      "multi_agent_worker_base_url",
    ],
    apiKeyKeys: [
      "multi_agent_worker_api_key",
    ],
    modelPlaceholder: "例如：gpt-4o / qwen-plus / deepseek-chat",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "探知 · 搜索",
    description: "擅长全网搜索与信息收集，用于强外部信息依赖的场景。",
    recommendation: "若服务商支持联网或内置搜索工具，优先接在这里；否则可填与闪电相同的快模型。",
    affectedScopes: "文献侦察（literature_scout）、综述检索规划（survey_planner）",
    icon: Search,
    iconColor: "#FF9F0A",
    modelKeys: [
      "multi_agent_literature_scout_model",
      "survey_planner_model",
    ],
    temperatureKeys: [
      "multi_agent_literature_scout_temperature",
      "survey_planner_temperature",
    ],
    baseUrlKeys: [
      "multi_agent_literature_scout_base_url",
      "survey_planner_base_url",
    ],
    apiKeyKeys: [
      "multi_agent_literature_scout_api_key",
      "survey_planner_api_key",
    ],
    modelPlaceholder: "例如：联网搜索模型 / perplexity / qwen-turbo",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "谋策 · 规划",
    description: "具备极强逻辑推理与拆解能力，负责深度调度与研究思路分析。",
    recommendation: "这里更适合旗舰推理模型，不必追求速度，准确性和逻辑性优先。",
    affectedScopes: "多 Agent 调度（supervisor）、研究规划分析与生成（planner_analysis / planner_generation）、多 Agent 研究规划（planner）",
    icon: Brain,
    iconColor: "#AF52DE",
    modelKeys: [
      "multi_agent_supervisor_model",
      "planner_analysis_model",
      "planner_generation_model",
      "multi_agent_planner_model",
    ],
    temperatureKeys: [
      "multi_agent_supervisor_temperature",
      "planner_analysis_temperature",
      "planner_generation_temperature",
      "multi_agent_planner_temperature",
    ],
    baseUrlKeys: [
      "multi_agent_supervisor_base_url",
      "planner_analysis_base_url",
      "planner_generation_base_url",
      "multi_agent_planner_base_url",
    ],
    apiKeyKeys: [
      "multi_agent_supervisor_api_key",
      "planner_analysis_api_key",
      "planner_generation_api_key",
      "multi_agent_planner_api_key",
    ],
    modelPlaceholder: "例如：deepseek-reasoner / o3 / claude-opus",
    temperaturePlaceholder: "0.1",
  },
  {
    title: "洞见 · 深度总结",
    description: "擅长长文本阅读与核心结论提炼，负责单篇大文献精读与长上下文读取。",
    recommendation: "优先选上下文窗口大、长文阅读能力强的模型；推理深度比速度重要。",
    affectedScopes: "论文精读（paper_analysis）、多 Agent 论文解析（paper_analyst）",
    icon: FileSearch,
    iconColor: "#5AC8FA",
    modelKeys: [
      "paper_analysis_model",
      "multi_agent_paper_analyst_model",
    ],
    temperatureKeys: [
      "paper_analysis_temperature",
      "multi_agent_paper_analyst_temperature",
    ],
    baseUrlKeys: [
      "paper_analysis_base_url",
      "multi_agent_paper_analyst_base_url",
    ],
    apiKeyKeys: [
      "paper_analysis_api_key",
      "multi_agent_paper_analyst_api_key",
    ],
    modelPlaceholder: "例如：gemini-2.5-pro / claude-sonnet / gpt-4.1",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "翰章 · 内容生成",
    description: "擅长结构化表达和流畅排版，负责综述长篇输出与最终整合。",
    recommendation: "适合长上下文、写作品质稳的模型；预算有限时可选均衡型模型。",
    affectedScopes: "综述写作（survey_writer）、多 Agent 综述（survey）、最终整合回答（synthesis）",
    icon: MessageSquare,
    iconColor: "#FF6B6B",
    modelKeys: [
      "survey_writer_model",
      "multi_agent_survey_model",
      "multi_agent_synthesis_model",
    ],
    temperatureKeys: [
      "survey_writer_temperature",
      "multi_agent_survey_temperature",
      "multi_agent_synthesis_temperature",
    ],
    baseUrlKeys: [
      "survey_writer_base_url",
      "multi_agent_survey_base_url",
      "multi_agent_synthesis_base_url",
    ],
    apiKeyKeys: [
      "survey_writer_api_key",
      "multi_agent_survey_api_key",
      "multi_agent_synthesis_api_key",
    ],
    modelPlaceholder: "例如：claude-sonnet / qwen-plus / gpt-4.1",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "构域 · 代码",
    description: "深入理解代码逻辑、实验环境和工程细节，负责论文复现场景。",
    recommendation: "这组建议更低温度，减少拍脑袋式推断；代码能力强的模型优先。",
    affectedScopes: "复现指导（paper_reproduction）、多 Agent 复现（reproduction）",
    icon: Hammer,
    iconColor: "#FF3B30",
    modelKeys: [
      "paper_reproduction_model",
      "multi_agent_reproduction_model",
    ],
    temperatureKeys: [
      "paper_reproduction_temperature",
      "multi_agent_reproduction_temperature",
    ],
    baseUrlKeys: [
      "paper_reproduction_base_url",
      "multi_agent_reproduction_base_url",
    ],
    apiKeyKeys: [
      "paper_reproduction_api_key",
      "multi_agent_reproduction_api_key",
    ],
    modelPlaceholder: "例如：deepseek-coder / claude-sonnet / gpt-4.1",
    temperaturePlaceholder: "0.25",
  },
  {
    title: "视界 · 视觉 (Beta)",
    description: "解读论文图表、架构图、公式截图等视觉内容，弥补纯文本模型的盲区。",
    recommendation: "需要多模态能力，推荐 GPT-4o / Gemini / Claude Sonnet 等原生支持图像输入的模型。后端视觉调用接口尚在开发中，配置后暂不生效。",
    affectedScopes: "论文图表解析、视觉内容问答（Beta，后端开发中）",
    icon: Eye,
    iconColor: "#30B0C7",
    modelKeys: ["vision_model"],
    temperatureKeys: ["vision_temperature"],
    baseUrlKeys: ["vision_base_url"],
    apiKeyKeys: ["vision_api_key"],
    modelPlaceholder: "例如：gpt-4o / gemini-2.0-flash / claude-sonnet",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "译衡 · 翻译",
    description: "中英学术互译，要求忠实原文，温度极低，适合专门优化了翻译的模型。",
    recommendation: "翻译不同于总结，忠实度优先于流畅度。建议选专注翻译或支持术语锁定的模型，温度设 0.1 或更低。后端翻译调用接口尚在开发中。",
    affectedScopes: "论文全文翻译、段落翻译（Beta，后端开发中）",
    icon: Compass,
    iconColor: "#5856D6",
    modelKeys: ["translation_model"],
    temperatureKeys: ["translation_temperature"],
    baseUrlKeys: ["translation_base_url"],
    apiKeyKeys: ["translation_api_key"],
    modelPlaceholder: "例如：deepseek-chat / gpt-4.1-mini / 专用翻译 API",
    temperaturePlaceholder: "0.1",
  },
];



type SaveState = "idle" | "saving" | "saved" | "error";
type TestState = "idle" | "testing" | "ok" | "error";
type UpdateState = "idle" | "checking" | "ready" | "latest" | "installing" | "disabled" | "error";

function formatUpdateDate(value?: string) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Settings() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [updateMsg, setUpdateMsg] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("connection");
  const [pendingLayout, setPendingLayout] = useState<LayoutMode>(getLayoutMode());

  const set = (key: keyof AppSettings) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setMany = (keys: (keyof AppSettings)[]) => (value: string) =>
    setForm((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        (next as Record<keyof AppSettings, string>)[key] = value;
      });
      return next;
    });

  const getSharedValue = (keys: (keyof AppSettings)[]) => {
    const values = keys
      .map((key) => (form[key] ?? "").trim())
      .filter(Boolean);
    if (values.length === 0) {
      return "";
    }
    return new Set(values).size === 1 ? values[0] : "";
  };

  const hasMixedValue = (keys: (keyof AppSettings)[]) => {
    const values = keys
      .map((key) => (form[key] ?? "").trim())
      .filter(Boolean);
    return new Set(values).size > 1;
  };

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const [data, version] = await Promise.all([
          apiClient.settings.get(),
          getVersion(),
        ]);
        if (!cancelled) {
          setForm({ ...DEFAULT_SETTINGS, ...data });
          setAppVersion(version);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveSettings = async () => {
    setSaveState("saving");
    try {
      await apiClient.settings.update(form);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2500);
    } catch (error) {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 3000);
      console.error("save settings failed:", error);
    }
  };

  const handleTestConnection = async () => {
    setTestState("testing");
    setTestMsg("");
    try {
      const reply = await apiClient.settings.test(form);
      setTestState("ok");
      setTestMsg(reply.slice(0, 80));
      window.setTimeout(() => setTestState("idle"), 4000);
    } catch (error) {
      setTestState("error");
      setTestMsg(formatErrorMessage(error).slice(0, 120));
      window.setTimeout(() => setTestState("idle"), 5000);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateState("checking");
    setUpdateMsg("");
    try {
      const info = await apiClient.updates.check();
      setUpdateInfo(info);
      if (!info.configured) {
        setUpdateState("disabled");
        setUpdateMsg("当前构建未配置升级源。开发环境通常会显示这个状态，正式发布版需要在 CI 中注入更新地址和公钥。");
        return;
      }
      if (info.available) {
        setUpdateState("ready");
        setUpdateMsg(`检测到新版本 ${info.version ?? ""}，可以直接下载并安装。`);
        return;
      }
      setUpdateState("latest");
      setUpdateMsg("当前已经是最新版本。");
    } catch (error) {
      setUpdateState("error");
      setUpdateMsg(formatErrorMessage(error));
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateState("installing");
    setUpdateMsg("正在下载并安装更新，完成后应用会自动重启。");
    try {
      await apiClient.updates.install();
      setUpdateMsg("更新已安装，应用即将重启。");
    } catch (error) {
      setUpdateState("error");
      setUpdateMsg(formatErrorMessage(error));
    }
  };

  const provider = form.llm_provider as LlmProvider;
  const activePreset = detectPreset(form);

  const applyPreset = (presetId: ProviderPresetId) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setForm((cur) => ({
      ...cur,
      llm_provider: preset.providerType,
      ...(preset.providerType === "openai_compatible"
        ? {
            openai_compatible_base_url: preset.baseUrl ?? cur.openai_compatible_base_url,
            openai_compatible_chat_model: preset.defaultChatModel || cur.openai_compatible_chat_model,
            openai_compatible_embedding_model: preset.defaultEmbedModel || cur.openai_compatible_embedding_model,
          }
        : {}),
    }));
  };

  const routingMode = form.multi_agent_routing_mode as MultiAgentRoutingMode;
  const enabledAgents = form.multi_agent_enabled_agents
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const visiblePaperTags = parsePaperTagVisibility(form.paper_visible_venue_tags);

  const toggleAgent = (agentName: string) => {
    const next = enabledAgents.includes(agentName)
      ? enabledAgents.filter((item) => item !== agentName)
      : [...enabledAgents, agentName];
    set("multi_agent_enabled_agents")(next.join(","));
  };

  const togglePaperTag = (key: (typeof PAPER_TAG_OPTIONS)[number]["key"]) => {
    set("paper_visible_venue_tags")(togglePaperTagVisibility(form.paper_visible_venue_tags, key));
  };

  const contentUnavailable = loading || Boolean(loadError);
  const displayVersion = updateInfo?.available ? updateInfo.version : appVersion || updateInfo?.current_version;
  const changelogPublishedAt = getChangelogReleaseDate(changelogRaw, displayVersion);
  const updatePublishedAt = formatUpdateDate(updateInfo?.pub_date || changelogPublishedAt);

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-nm-dark/10"
        style={{ background: "#EEF1F5" }}
      >
        <div>
          <h1 className="text-lg font-bold text-ink-primary leading-tight">设置</h1>
          <p className="text-xs text-ink-tertiary">按用途配置模型、检索和多 Agent 协作策略</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testState === "testing" || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background:
                  testState === "ok"
                    ? "linear-gradient(145deg,#40D466,#28A844)"
                    : testState === "error"
                      ? "linear-gradient(145deg,#FF5555,#CC2200)"
                      : "#E8ECF0",
                color: testState === "ok" || testState === "error" ? "#fff" : "#3C3C43",
                boxShadow:
                  testState === "idle" || testState === "testing"
                    ? "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF"
                    : "none",
              }}
            >
              {testState === "testing" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wifi className="w-3.5 h-3.5" />
              )}
              {testState === "testing"
                ? "测试中…"
                : testState === "ok"
                  ? "连接正常"
                  : testState === "error"
                    ? "连接失败"
                    : "测试连接"}
            </button>
            {testState === "error" && testMsg ? (
              <span className="absolute top-full left-0 mt-0.5 text-xs whitespace-nowrap text-red-500">
                {testMsg.slice(0, 30)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saveState === "saving" || loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background:
                saveState === "saved"
                  ? "linear-gradient(145deg,#40D466,#28A844)"
                  : saveState === "error"
                    ? "linear-gradient(145deg,#FF5555,#CC2200)"
                    : "linear-gradient(145deg,#1A8AFF,#0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
            }}
          >
            {saveState === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {saveState === "saved" ? <CheckCircle className="w-3.5 h-3.5" /> : null}
            {saveState === "error" ? <AlertCircle className="w-3.5 h-3.5" /> : null}
            {saveState === "saving"
              ? "保存中…"
              : saveState === "saved"
                ? "已保存"
                : saveState === "error"
                  ? "保存失败"
                  : "保存"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {SETTINGS_SECTIONS.map((item) => (
            <SettingsSectionTab
              key={item.key}
              icon={item.icon}
              color={item.color}
              label={item.label}
              description={item.description}
              active={activeSection === item.key}
              onClick={() => setActiveSection(item.key)}
            />
          ))}
        </div>

        {/* 当前分区摘要卡与上方导航重复，先注释掉。 */}
        {/*
        <Card padding="md" className="space-y-3">
          <div className="flex items-center gap-3">
            <SectionIcon icon={activeSectionMeta.icon} color={activeSectionMeta.color} />
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">{activeSectionMeta.label}</h2>
              <p className="text-xs text-ink-tertiary mt-0.5">{activeSectionMeta.description}</p>
            </div>
          </div>
        </Card>
        */}

        {loading ? (
          <Card padding="md" className="flex items-center gap-2 text-sm text-ink-tertiary">
            <Loader2 className="w-4 h-4 animate-spin" />
            从后端加载配置…
          </Card>
        ) : null}

        {loadError ? (
          <Card padding="md" className="flex items-center gap-2 text-sm text-apple-red">
            <AlertCircle className="w-4 h-4" />
            {loadError}
          </Card>
        ) : null}

        {activeSection === "connection" ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon={Brain} color="#AF52DE" />
              <div>
                <h2 className="text-sm font-semibold text-ink-primary">小妍</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  这里配置默认对话模型小妍。下面各个场景如果留空，会按继承规则回退到这里。
                </p>
              </div>
            </div>

            {!contentUnavailable ? (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-ink-tertiary ml-1">模型服务商</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROVIDER_PRESETS.map((preset) => {
                      const isActive = activePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                          style={
                            isActive
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
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {provider === "openai_compatible" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activePreset === "ollama" && (
                      <div className="md:col-span-2 rounded-2xl border border-green-200 bg-green-50/80 px-4 py-3">
                        <p className="text-xs leading-5 text-green-800">
                          Ollama 本地运行时默认不需要 API Key，接口地址默认为 <code className="font-mono">http://localhost:11434/v1</code>。接口密钥可填写任意字符（如 <code className="font-mono">ollama</code>）或留空。
                        </p>
                      </div>
                    )}
                    <SettingInput
                      label="接口地址"
                      value={form.openai_compatible_base_url}
                      onChange={set("openai_compatible_base_url")}
                      placeholder={
                        activePreset === "ollama"
                          ? "http://localhost:11434/v1"
                          : "https://api.deepseek.com/v1"
                      }
                      hint={
                        activePreset === "custom"
                          ? "任何兼容 OpenAI 接口格式的服务商都可以接在这里。"
                          : undefined
                      }
                    />
                    <SettingInput
                      label="接口密钥"
                      value={form.openai_compatible_api_key}
                      onChange={set("openai_compatible_api_key")}
                      placeholder={
                        PROVIDER_PRESETS.find((p) => p.id === activePreset)?.apiKeyPlaceholder ?? "sk-..."
                      }
                      sensitive
                      hint={activePreset === "ollama" ? "本地 Ollama 可填任意字符或留空" : `留空或输入 ${MASK} 表示不更改`}
                    />
                    <SettingInput
                      label="默认对话模型"
                      value={form.openai_compatible_chat_model}
                      onChange={set("openai_compatible_chat_model")}
                      placeholder={
                        PROVIDER_PRESETS.find((p) => p.id === activePreset)?.defaultChatModel || "模型名称"
                      }
                    />
                    <SettingInput
                      label="默认向量模型"
                      value={form.openai_compatible_embedding_model}
                      onChange={set("openai_compatible_embedding_model")}
                      placeholder={
                        PROVIDER_PRESETS.find((p) => p.id === activePreset)?.defaultEmbedModel || "BAAI/bge-m3"
                      }
                      hint={
                        activePreset === "moonshot" || activePreset === "gemini"
                          ? "该服务商暂不提供向量接口，建议在下方独立配置向量接口。"
                          : undefined
                      }
                    />
                  </div>
                ) : null}

                {provider === "openai" ? (
                  <div className="grid gap-3 md:grid-cols-2">
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
                      hint={`留空或输入 ${MASK} 表示不更改`}
                    />
                    <SettingInput
                      label="默认对话模型"
                      value={form.openai_chat_model}
                      onChange={set("openai_chat_model")}
                      placeholder="gpt-4o-mini"
                    />
                    <SettingInput
                      label="默认向量模型"
                      value={form.openai_embedding_model}
                      onChange={set("openai_embedding_model")}
                      placeholder="text-embedding-3-small"
                    />
                  </div>
                ) : null}

                {provider === "anthropic" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <SettingInput
                      label="接口密钥"
                      value={form.anthropic_api_key}
                      onChange={set("anthropic_api_key")}
                      placeholder="sk-ant-..."
                      sensitive
                      hint={`留空或输入 ${MASK} 表示不更改`}
                    />
                    <SettingInput
                      label="默认对话模型"
                      value={form.anthropic_chat_model}
                      onChange={set("anthropic_chat_model")}
                      placeholder="claude-3-5-haiku-20241022"
                    />
                  </div>
                ) : null}

                <div className="space-y-3 pt-1 border-t border-nm-dark/10">
                  <p className="text-xs font-medium text-ink-tertiary">外部学术服务</p>
                  <SettingInput
                    label="Semantic Scholar 接口密钥"
                    value={form.semantic_scholar_api_key}
                    onChange={set("semantic_scholar_api_key")}
                    placeholder="留空使用免费限速额度"
                    sensitive
                    hint={`留空或输入 ${MASK} 表示不更改`}
                  />
                </div>
              </>
            ) : null}
          </Card>
        ) : null}

        {activeSection === "connection" && !contentUnavailable ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon={Database} color="#5856D6" />
              <div>
                <h2 className="text-sm font-semibold text-ink-primary">向量化与检索</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  独立配置向量接口后，知识库、论文检索和 RAG 都会优先使用这里的模型。
                </p>
              </div>
            </div>

            {provider === "anthropic" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                <p className="text-xs leading-5 text-amber-800">
                  当前主服务商不提供向量接口。若你要使用知识库检索、论文检索和 RAG，建议在下方配置独立向量化接口。
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <SettingInput
                label="向量接口地址"
                value={form.embedding_base_url}
                onChange={set("embedding_base_url")}
                placeholder="https://api.openai.com/v1"
                hint="留空则沿用主模型服务商的向量接口设置。"
              />
              <SettingInput
                label="向量接口密钥"
                value={form.embedding_api_key}
                onChange={set("embedding_api_key")}
                placeholder="sk-..."
                sensitive
                hint={`留空或输入 ${MASK} 表示不更改`}
              />
              <SettingInput
                label="向量模型"
                value={form.embedding_model}
                onChange={set("embedding_model")}
                placeholder="text-embedding-3-small / bge-m3"
                hint="留空则沿用当前服务商的默认向量模型。"
              />
              <div className="grid grid-cols-3 gap-3">
                <SettingInput
                  label="分块大小"
                  value={form.chunk_size}
                  onChange={set("chunk_size")}
                  placeholder="800"
                />
                <SettingInput
                  label="重叠大小"
                  value={form.chunk_overlap}
                  onChange={set("chunk_overlap")}
                  placeholder="150"
                />
                <SettingInput
                  label="检索数量"
                  value={form.rag_top_k}
                  onChange={set("rag_top_k")}
                  placeholder="5"
                />
              </div>
            </div>
          </Card>
        ) : null}

        {activeSection === "paper_tags" && !contentUnavailable ? (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={Layers3} color="#FF9F0A" />
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">论文标签显示</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    控制论文库卡片上展示哪些来源标签。关闭后不会影响后端识别，只是不显示在卡片上。
                  </p>
                </div>
              </div>

              <div className="rounded-3xl px-4 py-4 space-y-3" style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}>
                <div className="flex flex-wrap gap-2">
                  {PAPER_TAG_OPTIONS.map((item) => (
                    <AgentChip
                      key={item.key}
                      label={item.label}
                      active={visiblePaperTags.has(item.key)}
                      onClick={() => togglePaperTag(item.key)}
                    />
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {PAPER_TAG_OPTIONS.map((item) => (
                    <p key={item.key} className="text-xs leading-5 text-ink-secondary">
                      {item.label}：{item.description}
                    </p>
                  ))}
                </div>
              </div>
            </Card>

            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={FileSearch} color="#0A84FF" />
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">导入论文自动重命名</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    导入时用 AI 识别标题、作者、年份等元数据，并按规则直接重命名原 PDF 文件，效果接近 Zotero 的重命名模板。
                  </p>
                </div>
              </div>

              <ToggleRow
                title="导入后自动重命名 PDF"
                description="开启后会在原目录就地改名。模型优先使用“方向提示模型（planner_hint_model）”，若未单独配置则回退到当前默认对话模型。"
                checked={form.paper_auto_rename_on_import === "true"}
                onToggle={() =>
                  set("paper_auto_rename_on_import")(form.paper_auto_rename_on_import === "true" ? "false" : "true")
                }
              />

              <div className="grid gap-3 md:grid-cols-2">
                <SettingInput
                  label="命名规则"
                  value={form.paper_auto_rename_rule}
                  onChange={set("paper_auto_rename_rule")}
                  placeholder="{first_author} - {title} ({year})"
                  hint="支持 {title}、{authors}、{first_author}、{year}、{venue}、{doi}、{original_name}。缺失字段会自动留空并尽量清理多余符号。"
                />
                <div
                  className="rounded-3xl px-4 py-4 space-y-3"
                  style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
                >
                  <p className="text-xs font-semibold text-ink-primary">可用占位符</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {[
                      "{title}：论文标题",
                      "{authors}：作者列表",
                      "{first_author}：第一作者",
                      "{year}：年份",
                      "{venue}：期刊或会议",
                      "{doi}：DOI",
                      "{original_name}：原始文件名",
                    ].map((item) => (
                      <p key={item} className="text-xs leading-5 text-ink-secondary">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "roles" && !contentUnavailable ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon={Sparkles} color="#0A84FF" />
              <div>
                <h2 className="text-sm font-semibold text-ink-primary">模型分工</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  将具备不同特征的模型分配给最适合的任务场景。完全留空则全部由“默认对话模型”承担。
                </p>
              </div>
            </div>

            <RecommendationList
              items={[
                "建议分工：流光负责极速轻量问答，元枢承担均衡主力，探知处理联网检索，谋策负责深度推理，洞见专注长文精读，翰章用于结构化写作，构域用于代码工程。按场景分配，效果与成本更优。",
                "视界与译衡现在就可以先配置；后端接口上线后会自动启用，无需二次设置。",
                "即使全部留空也可正常使用：所有角色会自动回退到「连接与检索」中的默认对话模型。",
                "如需让探知联网，可在其卡片中单独配置支持搜索的接口；其余角色仍使用主服务商。",
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              {CHARACTERISTIC_MODEL_CARDS.map((item) => (
                <GroupedModelCard
                  key={item.title}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  title={item.title}
                  description={item.description}
                  recommendation={item.recommendation}
                  affectedScopes={item.affectedScopes}
                  modelValue={getSharedValue(item.modelKeys)}
                  temperatureValue={getSharedValue(item.temperatureKeys)}
                  baseUrlValue={getSharedValue(item.baseUrlKeys)}
                  apiKeyValue={getSharedValue(item.apiKeyKeys)}
                  mixedBaseUrl={hasMixedValue(item.baseUrlKeys)}
                  mixedApiKey={hasMixedValue(item.apiKeyKeys)}
                  onModelChange={setMany(item.modelKeys)}
                  onTemperatureChange={setMany(item.temperatureKeys)}
                  onBaseUrlChange={setMany(item.baseUrlKeys)}
                  onApiKeyChange={setMany(item.apiKeyKeys)}
                  modelPlaceholder={item.modelPlaceholder}
                  temperaturePlaceholder={item.temperaturePlaceholder}
                />
              ))}
            </div>
          </Card>
        ) : null}

        {activeSection === "agents" && !contentUnavailable ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon={Bot} color="#34C759" />
              <div>
                <h2 className="text-sm font-semibold text-ink-primary">多 Agent 编排</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  控制多 Agent 模式的心智、选路策略与可用角色。
                </p>
              </div>
            </div>

            <ToggleRow
              title="启用多 Agent 编排"
              description="关闭后将只使用小妍轻量对话模型直接回复，不再拆分复杂任务，也不展示中间 Agent 推理过程。"
              checked={form.multi_agent_enabled === "true"}
              onToggle={() =>
                set("multi_agent_enabled")(form.multi_agent_enabled === "true" ? "false" : "true")
              }
            />

            <div className="space-y-2">
              <label className="block text-xs font-medium text-ink-tertiary ml-1">路由判断模式</label>
              <div className="flex gap-2 flex-wrap">
                {(["rule", "llm", "hybrid"] as const).map((value) => (
                  <ProviderTab
                    key={value}
                    label={ROUTING_MODE_COPY[value].label}
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
                  {ROUTING_MODE_COPY[routingMode].note}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-nm-dark/10">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-[#1A8AFF]" />
                <p className="text-sm font-semibold text-ink-primary">Agent 角色开关</p>
              </div>
              <p className="text-xs text-ink-tertiary">选择在多 Agent 协作时允许唤醒的分支角色。关闭某个角色后，调度模型将不会将其纳入考量。</p>
              
              <div className="flex gap-2 flex-wrap pb-2">
                {AGENT_OPTIONS.map(([value, label]) => (
                  <AgentChip
                    key={value}
                    label={label}
                    active={enabledAgents.includes(value)}
                    onClick={() => toggleAgent(value)}
                  />
                ))}
              </div>
              
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {AGENT_GUIDES.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold text-ink-primary">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <div className="grid gap-3 md:grid-cols-2">
                <SettingInput
                  label="单次最多调用的 Agent 步数上限"
                  value={form.multi_agent_max_steps}
                  onChange={set("multi_agent_max_steps")}
                  placeholder="6"
                  hint="超过该步数将强行中断多 Agent 思考流程，防止发散。"
                />
                <SettingInput
                  label="文献检索 Agent 抓取条数上限"
                  value={form.multi_agent_search_limit}
                  onChange={set("multi_agent_search_limit")}
                  placeholder="8"
                  hint="限制搜索接口每次带回来的文献条数，过大可能会导致被拦截或上下文超限。"
                />
              </div>
            </div>
          </Card>
        ) : null}

        {activeSection === "layout" ? (
          <Card padding="md" className="space-y-5">
            <div className="flex items-center gap-3">
              <SectionIcon icon={LayoutDashboard} color="#30B0C7" />
              <div>
                <h2 className="text-sm font-semibold text-ink-primary">界面布局模式</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">选择后重启软件生效</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  mode: "landscape" as LayoutMode,
                  label: "纵横",
                  description: "经典侧边栏导航，所有模块平铺展示，适合多任务并行。",
                },
                {
                  mode: "focus" as LayoutMode,
                  label: "聚焦",
                  description: "以研究主题为入口，生成后进入专属工作台，保持研究专注。",
                },
              ] as const).map(({ mode, label, description }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (mode === pendingLayout) return;
                    setPendingLayout(mode);
                    setLayoutMode(mode);
                    const root = document.getElementById("root");
                    root?.classList.add("dissolve-out");
                    setTimeout(() => void relaunch(), 480);
                  }}
                  className="rounded-[24px] p-4 text-left transition-all duration-150"
                  style={
                    pendingLayout === mode
                      ? {
                          background: "linear-gradient(145deg, rgba(26,138,255,0.12), rgba(255,255,255,0.92))",
                          boxShadow: "6px 6px 16px rgba(183,190,199,0.8), -6px -6px 16px rgba(255,255,255,0.95)",
                        }
                      : {
                          background: "#EEF1F5",
                          boxShadow: "5px 5px 14px #CBD0D7, -5px -5px 14px #FFFFFF",
                        }
                  }
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-ink-primary">{label}</p>
                    {pendingLayout === mode && (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: "#007AFF" }}
                      >
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-ink-secondary">{description}</p>
                </button>
              ))}
            </div>

            <div
              className="rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
              style={{ background: "rgba(200,205,211,0.3)", border: "1px solid rgba(200,205,211,0.5)" }}
            >
              切换布局后软件将自动重启，已保存的数据不受影响。
            </div>
          </Card>
        ) : null}

        {activeSection === "about" ? (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={RefreshCw} color="#5AC8FA" />
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">桌面端升级</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">发布版会从已配置的更新源检查新版本，并支持一键安装。</p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr),auto] lg:items-center">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-tertiary">当前版本</p>
                    <p className="mt-1 text-sm font-semibold text-ink-primary">{appVersion || updateInfo?.current_version || "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-tertiary">最新版本</p>
                    <p className="mt-1 text-sm font-semibold text-ink-primary">
                      {updateInfo?.available ? updateInfo.version : updateInfo ? "已是最新" : "未检测"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-tertiary">发布时间</p>
                    <p className="mt-1 text-sm font-semibold text-ink-primary">{updatePublishedAt || "未提供"}</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap lg:justify-end">
                  <button
                    type="button"
                    onClick={handleCheckUpdate}
                    disabled={loading || updateState === "checking" || updateState === "installing"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                    style={{
                      background: "#E8ECF0",
                      color: "#3C3C43",
                      boxShadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
                    }}
                  >
                    {updateState === "checking" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {updateState === "checking" ? "检查中…" : "检查更新"}
                  </button>
                  <button
                    type="button"
                    onClick={handleInstallUpdate}
                    disabled={updateState !== "ready"}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
                    style={{
                      background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                      boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
                    }}
                  >
                    {updateState === "installing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {updateState === "installing" ? "安装中…" : "下载并安装"}
                  </button>
                </div>
              </div>

              {updateMsg ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-xs leading-5 ${
                    updateState === "error"
                      ? "border-red-200 bg-red-50 text-red-600"
                      : updateState === "disabled"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : updateState === "ready"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-nm-dark/10 bg-white/35 text-ink-secondary"
                  }`}
                >
                  {updateMsg}
                </div>
              ) : null}

              {updateInfo?.body ? (
                <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                  <p className="text-xs font-semibold text-ink-primary">更新说明</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink-secondary">{updateInfo.body}</p>
                </div>
              ) : null}
            </Card>

            <Card padding="md" className="space-y-3">
              <div className="flex items-center gap-3">
                <SectionIcon icon={Info} color="#5AC8FA" />
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">说明</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">几条最容易混淆的配置规则</p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  "主模型连接是最后的兜底值。没有单独指定的场景，最终都会回退到这里。",
                  "按场景选模用于独立功能，比如规划提示、综述写作、论文精读和复现指导。",
                  "多 Agent 的专项覆盖只影响多 Agent 对话流程，不影响独立功能页的模型选择。",
                  "如果你刚开始配置，建议先填主对话模型、方向提示模型和最终整合模型，其他项之后再细化。",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-xs leading-5 text-ink-secondary">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            <ChangelogCard />
          </div>
        ) : null}
      </div>
    </div>
  );
}
