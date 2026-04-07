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
  KeyRound,
  Languages,
  LayoutDashboard,
  Loader2,
  Layers3,
  MessageSquare,
  Monitor,
  Moon,
  Sun,
  RefreshCw,
  Route,
  Sparkles,
  Upload,
  Wifi,
} from "lucide-react";
import { Card } from "@research-copilot/ui";
import { apiClient, formatErrorMessage, type UserMemory } from "../lib/client";
import { DEFAULT_PAPER_TAG_VISIBILITY_VALUE, PAPER_TAG_OPTIONS, parsePaperTagVisibility, togglePaperTagVisibility } from "../lib/paperTags";
import { getLayoutMode, setLayoutMode, type LayoutMode } from "../lib/layoutMode";
import { getThemePreference, setTheme, type ThemePreference } from "../lib/themeMode";
import { getThemeStyle, setThemeStyle, type ThemeStyle } from "../lib/themeStyle";
import MemorySection from "../features/settings/MemorySection";
import SkillsSection from "../features/settings/SkillsSection";
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
            background: "var(--rc-chip-inset-bg)",
            boxShadow: "var(--rc-chip-inset-shadow)",
          }}
          onFocus={(event) => {
            event.currentTarget.style.boxShadow =
              "var(--rc-chip-inset-shadow), 0 0 0 2px rgba(0,122,255,0.25)";
          }}
          onBlur={(event) => {
            event.currentTarget.style.boxShadow = "var(--rc-chip-inset-shadow)";
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
          <h2 className="text-base font-semibold text-ink-primary">更新日志</h2>
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
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
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
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
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
        background: "var(--rc-chip-inset-bg)",
        boxShadow: "var(--rc-chip-inset-shadow)",
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
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
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
        background: "var(--rc-chip-inset-bg)",
        boxShadow: "var(--rc-chip-inset-shadow)",
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

type SettingsSectionKey = "connection" | "paper_tags" | "roles" | "skills" | "memory" | "about" | "layout";

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
    description: "小妍主模型与服务商",
    icon: Brain,
    color: "#AF52DE",
  },
  {
    key: "roles",
    label: "小妍能力域",
    description: "按场景分配专属模型",
    icon: Sparkles,
    color: "#0A84FF",
  },
  {
    key: "paper_tags",
    label: "论文库",
    description: "管理论文显示与导入",
    icon: Layers3,
    color: "#FF9F0A",
  },
  {
    key: "skills",
    label: "小妍技能库",
    description: "提示词技能管理",
    icon: Zap,
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
    key: "memory",
    label: "记忆管理",
    description: "查看与管理小妍的记忆",
    icon: Brain,
    color: "#FF9F0A",
  },
  {
    key: "about",
    label: "更多设置",
    description: "查看版本与升级",
    icon: Info,
    color: "#5AC8FA",
  },
];

function SettingsSectionTab({
  icon: Icon,
  color,
  label,
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
      className="rounded-[24px] px-3.5 py-3 text-left transition-all duration-150"
      style={
        active
          ? {
              background: "var(--rc-elevated)",
              border: "1px solid rgba(10,132,255,0.35)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
            }
          : {
              background: "var(--rc-surface)",
              border: "1px solid var(--rc-border)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.3)",
            }
      }
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "var(--rc-card-inset-bg)",
            border: "1px solid var(--rc-border)",
            color,
            boxShadow: "var(--rc-inset-shadow)",
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-ink-primary leading-tight truncate">{label}</p>
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
        <p className="text-sm font-semibold text-ink-primary">小妍配置建议</p>
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
  secondaryFieldLabel?: string;
  secondaryFieldHint?: string;
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
  secondaryFieldLabel,
  secondaryFieldHint,
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
  secondaryFieldLabel?: string;
  secondaryFieldHint?: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div
      className="rounded-[28px] p-4 space-y-4"
      style={{
        background: "var(--rc-chip-bg)",
        boxShadow: "var(--rc-chip-shadow)",
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
        <p className="text-xs font-semibold tracking-wide text-ink-secondary">适用范围</p>
        <p className="text-xs leading-5 text-ink-secondary">{affectedScopes}</p>
        <p className="text-xs leading-5 text-ink-tertiary">{recommendation}</p>
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
          label={secondaryFieldLabel ?? "统一温度"}
          value={temperatureValue}
          onChange={onTemperatureChange}
          placeholder={temperaturePlaceholder}
          hint={secondaryFieldHint ?? "留空表示继续沿用各自已有温度；重新填写会统一覆盖这一组。"}
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
  ["planner", "谋策模型"],
  ["retrieval", "溯源模型"],
  ["literature_scout", "探知模型"],
  ["paper_analyst", "洞见模型"],
  ["survey", "翰章模型"],
  ["reproduction", "构域模型"],
  ["synthesis", "整合模型"],
] as const;

const ROUTING_MODE_COPY: Record<MultiAgentRoutingMode, { label: string; description: string; note: string }> = {
  rule: {
    label: "规则判断",
    description: "根据关键词和上下文类型固定选择能力域模型，最稳定，也最容易复现。",
    note: "这一模式不会调用调度模型，适合你想严格控制成本和行为边界时使用。",
  },
  llm: {
    label: "模型判断",
    description: "由调度模型实时决定该启用哪些能力域模型，更灵活，也更依赖模型本身。",
    note: "适合复杂提问和开放式任务。建议给调度模型配置快一些、判断力强一些的模型。",
  },
  hybrid: {
    label: "混合判断",
    description: "先用规则确定基础班底，再由调度模型补充和重排，兼顾稳定性和灵活性。",
    note: "这是当前最推荐的模式。研究路线、选题调研这类复合任务会保留关键能力域模型，再由模型补充额外角色。",
  },
};

const AGENT_GUIDES = [
  { key: "planner", label: "谋策模型", description: "拆解研究主题、学习路径和阶段目标。" },
  { key: "retrieval", label: "溯源模型", description: "先从知识库和论文库找证据，适合需要依据的问题。" },
  { key: "literature_scout", label: "探知模型", description: "先找代表性论文、研究脉络和阅读入口。" },
  { key: "paper_analyst", label: "洞见模型", description: "聚焦单篇论文的方法、实验和局限。" },
  { key: "survey", label: "翰章模型", description: "把线索整理成结构化综述和趋势判断。" },
  { key: "reproduction", label: "构域模型", description: "聚焦实现细节、实验配置和复现风险。" },
  { key: "synthesis", label: "整合模型", description: "把各专项能力域模型的结果整合成最终回答。" },
];




const CHARACTERISTIC_MODEL_CARDS: GroupedModelDefinition[] = [
  // ── 用户入口层：日常轻量 ──
  {
    title: "流光 · 快速响应",
    description: "反应极快，负责方向提示和小妍日常轻量对话。",
    recommendation: "优先选低延迟、低成本的快模型，用量最大，对速度要求最高。",
    affectedScopes: "方向提示、小妍轻量对话",
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
  // ── 核心调度层：大脑中枢 ──
  {
    title: "谋策 · 规划",
    description: "具备极强逻辑推理与拆解能力，负责深度调度与研究思路分析。",
    recommendation: "这里更适合旗舰推理模型，不必追求速度，准确性和逻辑性优先。",
    affectedScopes: "多能力域模型调度、研究规划分析与生成",
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
  // ── 通用兜底层：默认执行 ──
  {
    title: "元枢 · 默认执行",
    description: "各方面能力均衡，作为所有专项任务的默认执行基座。",
    recommendation: "没有单独指定时，多能力域模型工作节点默认回退到这里——选一个稳定均衡的主力模型即可。",
    affectedScopes: "多能力域模型通用工作节点",
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
  // ── 信息获取层：检索与搜索 ──
  {
    title: "溯源 · 向量化与检索",
    description: "负责知识库向量化、语义检索与 RAG 证据回溯，决定答案的可验证性。",
    recommendation: "优先选择稳定的 embedding 模型与向量接口；检索数量建议 5-8，过高会拉长响应且引入噪声。",
    affectedScopes: "知识库向量化、语义检索与 RAG 溯源",
    icon: Database,
    iconColor: "#1F8A70",
    modelKeys: [
      "embedding_model",
    ],
    temperatureKeys: [
      "rag_top_k",
    ],
    baseUrlKeys: [
      "embedding_base_url",
    ],
    apiKeyKeys: [
      "embedding_api_key",
    ],
    modelPlaceholder: "例如：text-embedding-3-small / BAAI/bge-m3",
    temperaturePlaceholder: "5",
    secondaryFieldLabel: "统一检索数量",
    secondaryFieldHint: "留空表示沿用现有 RAG 检索数量；重新填写会统一覆盖为同一检索上限。",
  },
  {
    title: "探知 · 搜索",
    description: "擅长全网搜索与信息收集，用于强外部信息依赖的场景。",
    recommendation: "若服务商支持联网或内置搜索工具，优先接在这里；否则可填与「流光」相同的快模型。",
    affectedScopes: "文献侦察检索、综述检索规划",
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
  // ── 分析层：深度理解 ──
  {
    title: "洞见 · 深度总结",
    description: "擅长长文本阅读与核心结论提炼，负责单篇大文献精读与长上下文读取。",
    recommendation: "优先选上下文窗口大、长文阅读能力强的模型；推理深度比速度重要。",
    affectedScopes: "论文精读、深度分析",
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
  // ── 输出层：生成与整合 ──
  {
    title: "翰章 · 内容生成",
    description: "擅长结构化表达和流畅排版，负责综述长篇输出与最终整合。",
    recommendation: "适合长上下文、写作品质稳的模型；预算有限时可选均衡型模型。",
    affectedScopes: "综述写作、最终整合回答",
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
  // ── 专项能力层：特殊场景 ──
  {
    title: "构域 · 代码",
    description: "深入理解代码逻辑、实验环境和工程细节，负责论文复现场景。",
    recommendation: "这组建议更低温度，减少拍脑袋式推断；代码能力强的模型优先。",
    affectedScopes: "复现指导、代码分析",
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
    title: "视界 · 视觉",
    description: "扫描 PDF 中的图表、架构图与公式截图，补充 lopdf 无法提取的矢量图和表格。",
    recommendation: "需要多模态能力，推荐 GPT-4o / Gemini / Claude Sonnet 等原生支持图像输入的模型。",
    affectedScopes: "论文解读时的图表扫描（矢量图、表格补充识别）",
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
    recommendation: "翻译不同于总结，忠实度优先于流畅度。建议选专注翻译或支持术语锁定的模型，温度设 0.1 或更低。",
    affectedScopes: "论文全文翻译、段落翻译（Beta，后端开发中）",
    icon: Languages,
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
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>(getThemePreference());
  const [currentStyle, setCurrentStyle] = useState<ThemeStyle>(getThemeStyle());
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [clearingAuto, setClearingAuto] = useState(false);
  // Import / Export
  type CryptoModal = { mode: "export" } | { mode: "import"; fileData: string } | null;
  const [cryptoModal, setCryptoModal] = useState<CryptoModal>(null);
  const [cryptoPassword, setCryptoPassword] = useState("");
  const [cryptoConfirm, setCryptoConfirm] = useState("");
  const [cryptoBusy, setCryptoBusy] = useState(false);
  const [cryptoError, setCryptoError] = useState("");

  // Ollama models
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingOllamaModels, setLoadingOllamaModels] = useState(false);

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

  const openExportModal = () => {
    setCryptoModal({ mode: "export" });
    setCryptoPassword("");
    setCryptoConfirm("");
    setCryptoError("");
  };

  const openImportPicker = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ filters: [{ name: "配置文件", extensions: ["rcconf"] }], multiple: false });
      if (!file) return;
      const filePath = typeof file === "string" ? file : (file as { path: string }).path;
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const data = await readTextFile(filePath);
      setCryptoModal({ mode: "import", fileData: data.trim() });
      setCryptoPassword("");
      setCryptoError("");
    } catch (e) {
      setCryptoError(String(e));
    }
  };

  const handleCryptoConfirm = async () => {
    if (!cryptoModal) return;
    if (!cryptoPassword.trim()) { setCryptoError("密码不能为空。"); return; }
    if (cryptoModal.mode === "export" && cryptoPassword !== cryptoConfirm) {
      setCryptoError("两次密码不一致。"); return;
    }
    setCryptoBusy(true);
    setCryptoError("");
    try {
      if (cryptoModal.mode === "export") {
        const blob = await apiClient.settings.export(cryptoPassword);
        const { save } = await import("@tauri-apps/plugin-dialog");
        const savePath = await save({ defaultPath: "settings.rcconf", filters: [{ name: "配置文件", extensions: ["rcconf"] }] });
        if (savePath) {
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          await writeTextFile(savePath, blob);
          setCryptoModal(null);
          setSaveState("saved");
          window.setTimeout(() => setSaveState("idle"), 2500);
          void apiClient.memory.add({ type: "auto", action: "settings.export", summary: "导出了加密配置文件" });
        } else {
          setCryptoModal(null);
        }
      } else {
        const keys = await apiClient.settings.import(cryptoModal.fileData, cryptoPassword);
        // Reload settings into form
        const fresh = await apiClient.settings.get();
        setForm(fresh as typeof form);
        setCryptoModal(null);
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 2500);
        void apiClient.memory.add({ type: "auto", action: "settings.import", summary: `导入了 ${keys.length} 项配置` });
      }
    } catch (e) {
      setCryptoError(String(e));
    } finally {
      setCryptoBusy(false);
    }
  };

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
    <>
    <div className="h-full flex flex-col">
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "var(--rc-header-bg)", borderColor: "var(--rc-border)" }}
      >
        <div>
          <h1 className="text-lg font-bold text-ink-primary leading-tight">设置</h1>
          <p className="text-xs text-ink-tertiary">按用途配置小妍能力域、检索参数和多能力域模型协作策略</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 导出配置 */}
          <button
            type="button"
            onClick={openExportModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95"
            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
            title="将当前配置（含 API Key）加密导出为 .rcconf 文件"
          >
            <Download className="w-3.5 h-3.5" />
            导出配置
          </button>
          {/* 导入配置 */}
          <button
            type="button"
            onClick={() => void openImportPicker()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95"
            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
            title="从 .rcconf 文件导入配置（会覆盖当前配置）"
          >
            <Upload className="w-3.5 h-3.5" />
            导入配置
          </button>
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
                      : "var(--rc-chip-bg)",
                color: testState === "ok" || testState === "error" ? "#fff" : "var(--rc-text-soft)",
                boxShadow:
                  testState === "idle" || testState === "testing"
                    ? "var(--rc-chip-shadow)"
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
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
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
              <h2 className="text-base font-semibold text-ink-primary">{activeSectionMeta.label}</h2>
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
                <h2 className="text-base font-semibold text-ink-primary">小妍</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  在这里配置小妍的默认对话模型。如果小妍的能力域自定义留空，会按继承规则回退到这里。
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
                                  background: "var(--rc-chip-inset-bg)",
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
                      <div className="md:col-span-2 rounded-2xl border border-green-200 bg-green-50/80 px-4 py-3 space-y-2">
                        <p className="text-xs leading-5 text-green-800">
                          Ollama 本地运行时默认不需要 API Key，接口地址默认为 <code className="font-mono">http://localhost:11434/v1</code>。接口密钥可填写任意字符（如 <code className="font-mono">ollama</code>）或留空。
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={loadingOllamaModels}
                            onClick={async () => {
                              setLoadingOllamaModels(true);
                              try {
                                const models = await apiClient.settings.listOllamaModels(form.openai_compatible_base_url || undefined);
                                setOllamaModels(models);
                              } catch {
                                setOllamaModels([]);
                              } finally {
                                setLoadingOllamaModels(false);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 disabled:opacity-60"
                            style={{ background: "rgba(52,199,89,0.15)", color: "#1A7A2E" }}
                          >
                            {loadingOllamaModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            获取本地模型
                          </button>
                          {ollamaModels.length > 0 && ollamaModels.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setForm((cur) => ({ ...cur, openai_compatible_chat_model: m }))}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono transition-colors hover:bg-green-100"
                              style={{ color: "#1A7A2E" }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
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

        {activeSection === "paper_tags" && !contentUnavailable ? (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={FileSearch} color="#0A84FF" />
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">导入论文识别内容</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    导入时由小妍从 PDF 正文中自动识别并填写论文元数据，关闭某项后该字段将保留文件名猜测值或留空。模型优先使用"方向提示模型"，未单独配置则回退到默认对话模型。
                  </p>
                </div>
              </div>

              <div className="rounded-3xl px-4 py-4 space-y-3" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "paper_import_recognize_title", label: "名称" },
                    { key: "paper_import_recognize_authors", label: "作者" },
                    { key: "paper_import_recognize_year", label: "年份" },
                    { key: "paper_import_recognize_venue", label: "期刊 / 会议" },
                    { key: "paper_import_recognize_keywords", label: "关键词" },
                  ] as { key: keyof typeof form; label: string }[]).map((item) => (
                    <AgentChip
                      key={item.key}
                      label={item.label}
                      active={form[item.key] !== "false"}
                      onClick={() => set(item.key)(form[item.key] !== "false" ? "false" : "true")}
                    />
                  ))}
                </div>
                <div className="grid gap-1.5 md:grid-cols-2">
                  {([
                    { label: "名称", description: "从正文提取正式标题，比文件名猜测更准确" },
                    { label: "作者", description: "提取所有作者姓名，英文逗号分隔" },
                    { label: "年份", description: "提取发表年份，用于排序与筛选" },
                    { label: "期刊 / 会议", description: "提取发表场所，用于来源标签显示" },
                    { label: "关键词", description: "AI 提取 3-8 个核心学术关键词，比文本统计更贴合主题" },
                  ]).map((item) => (
                    <p key={item.label} className="text-xs leading-5 text-ink-secondary">
                      {item.label}：{item.description}
                    </p>
                  ))}
                </div>
              </div>
            </Card>
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={Layers3} color="#FF9F0A" />
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">论文标签显示</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    控制论文库卡片上展示哪些来源标签。关闭后不会影响后端识别，只是不显示在卡片上。
                  </p>
                </div>
              </div>

              <div className="rounded-3xl px-4 py-4 space-y-3" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
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
          </div>
        ) : null}

        {activeSection === "roles" && !contentUnavailable ? (
          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon={Sparkles} color="#0A84FF" />
              <div>
                <h2 className="text-base font-semibold text-ink-primary">模型分工</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  将具备不同特征的模型分配给小妍的不同能力模块。完全留空则全部由“默认对话模型”承担。
                </p>
              </div>
            </div>

            <RecommendationList
              items={[
                "建议分工：溯源负责向量化与检索，流光负责极速轻量问答，元枢承担均衡主力，探知处理联网检索，谋策负责深度推理，洞见专注长文精读，翰章用于结构化写作，构域用于代码工程，视界主攻多模态解析。按场景分配，效果与成本更优。",
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
                  secondaryFieldLabel={item.secondaryFieldLabel}
                  secondaryFieldHint={item.secondaryFieldHint}
                />
              ))}
            </div>

            {/* ── 多能力域模型编排 ── */}
            <div className="pt-4 border-t border-nm-dark/10 space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={Bot} color="#34C759" />
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">多能力域模型编排</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    控制小妍的多能力域模型协作心智、选路策略与可用角色。
                  </p>
                </div>
              </div>

              <ToggleRow
                title="启用多能力域模型编排"
                description="关闭后将只使用小妍轻量对话模型直接回复，不再拆分复杂任务，也不展示中间能力域模型推理过程。"
                checked={form.multi_agent_enabled === "true"}
                onToggle={() =>
                  set("multi_agent_enabled")(form.multi_agent_enabled === "true" ? "false" : "true")
                }
              />

              <div className="space-y-2">
                <label className="block text-xs font-medium text-ink-tertiary ml-1">小妍路由判断模式</label>
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
                  <p className="mt-2 text-xs leading-5 text-ink-tertiary">
                    {ROUTING_MODE_COPY[routingMode].note}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-[#1A8AFF]" />
                  <p className="text-sm font-semibold text-ink-primary">能力域模型开关</p>
                </div>
                <p className="text-xs text-ink-tertiary">选择小妍在多能力域模型协作时允许唤醒的能力域模型。关闭某个能力域模型后，调度模型将不会将其纳入考量。</p>

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
                      <p className="mt-1 text-xs leading-5 text-ink-tertiary">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <SettingInput
                  label="单次最多调用的能力域模型步数上限"
                  value={form.multi_agent_max_steps}
                  onChange={set("multi_agent_max_steps")}
                  placeholder="6"
                  hint="超过该步数将强行中断能力域模型思考流程，防止发散。"
                />
                <SettingInput
                  label="文献检索模型抓取条数上限"
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
                <h2 className="text-base font-semibold text-ink-primary">界面布局模式</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">选择后重启软件生效</p>
              </div>
            </div>

            {/* Theme toggle */}
            <div>
              <p className="text-xs font-medium text-ink-tertiary mb-2 ml-1">外观主题</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  {
                    mode: "auto" as ThemePreference,
                    label: "跟随系统",
                    description: "随 macOS / Windows 深浅模式自动切换。",
                    icon: Monitor,
                  },
                  {
                    mode: "light" as ThemePreference,
                    label: "浅色",
                    description: "明亮的浅色界面，适合白天使用。",
                    icon: Sun,
                  },
                  {
                    mode: "dark" as ThemePreference,
                    label: "深色",
                    description: "护眼的深色界面，适合低光环境。",
                    icon: Moon,
                  },
                ] as const).map(({ mode, label, description, icon: ThemeIcon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (mode === currentTheme) return;
                      setCurrentTheme(mode);
                      setTheme(mode);
                    }}
                    className="rounded-[24px] p-4 text-left transition-all duration-150"
                    style={
                      currentTheme === mode
                        ? {
                            background: "rgb(0 122 255 / 0.16)",
                            border: "1px solid rgb(0 122 255 / 0.42)",
                            boxShadow: "0 10px 24px rgb(0 122 255 / 0.18)",
                          }
                        : {
                            background: "var(--rc-elevated)",
                            border: "1px solid var(--rc-border)",
                            boxShadow: "0 8px 18px rgb(var(--rc-sidebar-shadow-rgb) / 0.16)",
                          }
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <ThemeIcon className="w-4 h-4 text-ink-secondary" />
                        <p className="text-sm font-semibold text-ink-primary">{label}</p>
                      </div>
                      {currentTheme === mode && (
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
            </div>

            {/* Style preset picker */}
            <div>
              <p className="text-xs font-medium text-ink-tertiary mb-2 ml-1">界面风格</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  {
                    style: "neumorphic" as ThemeStyle,
                    label: "拟态",
                    description: "柔和的软投影与渐变质感，营造沉浸的科技氛围。",
                    preview: (
                      <svg width="48" height="32" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="32" rx="6" fill="#1D2430"/>
                        <rect x="6" y="6" width="36" height="20" rx="4" fill="url(#nm-grad)" filter="url(#nm-shadow)"/>
                        <rect x="10" y="11" width="16" height="3" rx="1.5" fill="#C7D0DC" opacity="0.6"/>
                        <rect x="10" y="17" width="10" height="2" rx="1" fill="#8D99AA" opacity="0.5"/>
                        <defs>
                          <linearGradient id="nm-grad" x1="6" y1="6" x2="42" y2="26" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#2A3448"/>
                            <stop offset="1" stopColor="#141A22"/>
                          </linearGradient>
                          <filter id="nm-shadow" x="-4" y="-4" width="56" height="36">
                            <feDropShadow dx="3" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.5"/>
                            <feDropShadow dx="-2" dy="-2" stdDeviation="2" floodColor="#fff" floodOpacity="0.04"/>
                          </filter>
                        </defs>
                      </svg>
                    ),
                  },
                  {
                    style: "modern-minimal" as ThemeStyle,
                    label: "极简",
                    description: "纯色底面、1px 分割线，克制而精密的生产力界面。",
                    preview: (
                      <svg width="48" height="32" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="32" rx="6" fill="#000"/>
                        <rect x="6" y="6" width="36" height="20" rx="3" fill="#111" stroke="#262626" strokeWidth="0.75"/>
                        <rect x="10" y="11" width="16" height="2.5" rx="1" fill="#fafafa" opacity="0.8"/>
                        <rect x="10" y="17" width="10" height="1.5" rx="0.75" fill="#52525b"/>
                        <rect x="6" y="26" width="36" height="0.5" fill="#262626"/>
                      </svg>
                    ),
                  },
                ] as const).map(({ style, label, description, preview }) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      if (style === currentStyle) return;
                      setCurrentStyle(style);
                      setThemeStyle(style);
                    }}
                    className="rounded-[24px] p-4 text-left transition-all duration-150"
                    style={
                      currentStyle === style
                        ? {
                            background: "rgb(0 122 255 / 0.16)",
                            border: "1px solid rgb(0 122 255 / 0.42)",
                            boxShadow: "0 10px 24px rgb(0 122 255 / 0.18)",
                          }
                        : {
                            background: "var(--rc-elevated)",
                            border: "1px solid var(--rc-border)",
                            boxShadow: "0 8px 18px rgb(var(--rc-sidebar-shadow-rgb) / 0.16)",
                          }
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        {preview}
                        <p className="text-sm font-semibold text-ink-primary">{label}</p>
                      </div>
                      {currentStyle === style && (
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
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
            </div>

            <div>
              <p className="text-xs font-medium text-ink-tertiary mb-2 ml-1">布局模式</p>
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
                          background: "rgb(0 122 255 / 0.16)",
                          border: "1px solid rgb(0 122 255 / 0.42)",
                          boxShadow: "0 10px 24px rgb(0 122 255 / 0.18)",
                        }
                      : {
                          background: "var(--rc-elevated)",
                          border: "1px solid var(--rc-border)",
                          boxShadow: "0 8px 18px rgb(var(--rc-sidebar-shadow-rgb) / 0.16)",
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
            </div>

            <div
              className="rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
              style={{ background: "rgba(200,205,211,0.3)", border: "1px solid rgba(200,205,211,0.5)" }}
            >
              切换布局后软件将自动重启，已保存的数据不受影响。
            </div>
          </Card>
        ) : null}

        {activeSection === "skills" ? (
          <SkillsSection />
        ) : null}

        {activeSection === "memory" ? (
          <MemorySection
            memories={memories}
            loading={memoriesLoading}
            clearingAuto={clearingAuto}
            onEnter={() => {
              setMemoriesLoading(true);
              apiClient.memory.list().then((data) => {
                setMemories(data);
              }).catch(() => {}).finally(() => setMemoriesLoading(false));
            }}
            onDelete={(id) => {
              void apiClient.memory.delete(id).then(() => {
                setMemories((prev) => prev.filter((m) => m.id !== id));
              });
            }}
            onClearAuto={() => {
              setClearingAuto(true);
              void apiClient.memory.clearAuto().then(() => {
                setMemories((prev) => prev.filter((m) => m.type !== "auto"));
              }).finally(() => setClearingAuto(false));
            }}
          />
        ) : null}

        {activeSection === "about" ? (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon={RefreshCw} color="#5AC8FA" />
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">桌面端升级</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">发布版会从已配置的更新源检查新版本，并支持一键安装。</p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr),auto] lg:items-center">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-tertiary">当前版本</p>
                    <p className="mt-1 text-sm font-semibold text-ink-primary">{appVersion || updateInfo?.current_version || "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-tertiary">最新版本</p>
                    <p className="mt-1 text-sm font-semibold text-ink-primary">
                      {updateInfo?.available ? updateInfo.version : updateInfo ? "已是最新" : "未检测"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-tertiary">发布时间</p>
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
                      background: "var(--rc-chip-bg)",
                      color: "var(--rc-text-soft)",
                      boxShadow: "var(--rc-chip-shadow)",
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
                  <h2 className="text-base font-semibold text-ink-primary">说明</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">几条最容易混淆的配置规则</p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  "主模型连接是最后的兜底值。没有单独指定的场景，最终都会回退到这里。",
                  "按场景选模用于独立功能，比如规划提示、综述写作、论文精读和复现指导。",
                  "多能力域模型的专项覆盖只影响多能力域模型对话流程，不影响独立功能页的模型选择。",
                  "如果你刚开始配置，建议先填主对话模型、方向提示模型和最终整合模型，其他项之后再细化。",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-xs leading-5 text-ink-secondary">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* TODO: Obsidian 导出（暂时注释，待完善路径配置后启用）
            <Card padding="md" className="space-y-4">
              ... Obsidian export card ...
            </Card>
            */}

            <ChangelogCard />
          </div>
        ) : null}
      </div>
    </div>

    {/* 加密密码弹窗 */}
    {cryptoModal !== null && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setCryptoModal(null); }}
      >
        <div
          className="w-full max-w-sm mx-4 rounded-3xl p-6 space-y-4"
          style={{ background: "var(--rc-card-bg)", boxShadow: "12px 12px 28px rgba(0,0,0,0.45), 0 0 0 1px var(--rc-border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
              <KeyRound className="w-5 h-5 text-apple-blue" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary">
                {cryptoModal.mode === "export" ? "加密导出配置" : "解密导入配置"}
              </h3>
              <p className="text-xs text-ink-tertiary mt-0.5">
                {cryptoModal.mode === "export"
                  ? "设置一个密码保护配置文件，导入时需要输入同一密码。"
                  : "输入导出时设置的密码解锁配置文件。"}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-tertiary ml-1">密码</label>
              <input
                type="password"
                value={cryptoPassword}
                onChange={(e) => { setCryptoPassword(e.target.value); setCryptoError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !cryptoBusy) void handleCryptoConfirm(); }}
                placeholder="输入密码"
                autoFocus
                className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
                style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
              />
            </div>
            {cryptoModal.mode === "export" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-tertiary ml-1">确认密码</label>
                <input
                  type="password"
                  value={cryptoConfirm}
                  onChange={(e) => { setCryptoConfirm(e.target.value); setCryptoError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !cryptoBusy) void handleCryptoConfirm(); }}
                  placeholder="再次输入密码"
                  className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
                  style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                />
              </div>
            )}
            {cryptoModal.mode === "export" && (
              <p className="text-xs text-ink-tertiary leading-relaxed px-1">
                配置文件包含所有 API Key，请妥善保管，切勿分享给他人。
              </p>
            )}
            {cryptoError && (
              <p className="text-xs text-apple-red px-1">{cryptoError}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCryptoModal(null)}
              className="flex-1 py-2 rounded-2xl text-sm font-medium transition-all duration-150"
              style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleCryptoConfirm()}
              disabled={cryptoBusy || !cryptoPassword.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(145deg, #1A8AFF, #0062CC)", boxShadow: "4px 4px 10px rgba(0,62,204,0.3)" }}
            >
              {cryptoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              {cryptoBusy ? "处理中…" : cryptoModal.mode === "export" ? "加密并保存" : "解密并导入"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
