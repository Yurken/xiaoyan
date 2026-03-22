import { useEffect, useState, type ComponentType } from "react";
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

type SettingsSectionKey = "connection" | "paper_tags" | "roles" | "agents" | "about";

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
    description: "服务商、主模型、向量化与 RAG",
    icon: Brain,
    color: "#AF52DE",
  },
  {
    key: "paper_tags",
    label: "论文库",
    description: "标签显示与导入命名",
    icon: Layers3,
    color: "#FF9F0A",
  },
  {
    key: "roles",
    label: "模型分工",
    description: "按常用场景统一配置模型",
    icon: Sparkles,
    color: "#0A84FF",
  },
  {
    key: "agents",
    label: "多 agent",
    description: "编排模式、覆盖和高级设置",
    icon: Bot,
    color: "#34C759",
  },
  {
    key: "about",
    label: "说明",
    description: "查看继承规则、版本和升级",
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

function ModelRoleCard({
  icon: Icon,
  iconColor,
  title,
  description,
  recommendation,
  fallback,
  modelValue,
  onModelChange,
  modelPlaceholder,
  temperatureValue,
  onTemperatureChange,
  temperaturePlaceholder,
}: {
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  recommendation: string;
  fallback: string;
  modelValue: string;
  onModelChange: (value: string) => void;
  modelPlaceholder: string;
  temperatureValue: string;
  onTemperatureChange: (value: string) => void;
  temperaturePlaceholder: string;
}) {
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
        <p className="text-[11px] font-semibold tracking-wide text-ink-secondary">选型建议</p>
        <p className="text-xs leading-5 text-ink-secondary">{recommendation}</p>
        <p className="text-[11px] leading-5 text-ink-tertiary">{fallback}</p>
      </div>
      <div className="grid gap-3">
        <SettingInput
          label="模型名称"
          value={modelValue}
          onChange={onModelChange}
          placeholder={modelPlaceholder}
        />
        <SettingInput
          label="温度"
          value={temperatureValue}
          onChange={onTemperatureChange}
          placeholder={temperaturePlaceholder}
          hint="一般建议 0.1 到 0.4。越低越稳定，越高越发散。"
        />
      </div>
    </div>
  );
}

type ModelRoleDefinition = {
  title: string;
  description: string;
  recommendation: string;
  fallback: string;
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  modelKey: keyof AppSettings;
  temperatureKey: keyof AppSettings;
  modelPlaceholder: string;
  temperaturePlaceholder: string;
};

type GroupedModelDefinition = {
  title: string;
  description: string;
  recommendation: string;
  affectedScopes: string;
  icon: ComponentType<{ className?: string }>;
  iconColor: string;
  modelKeys: (keyof AppSettings)[];
  temperatureKeys: (keyof AppSettings)[];
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
  mixedModel,
  mixedTemperature,
  onModelChange,
  onTemperatureChange,
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
  mixedModel: boolean;
  mixedTemperature: boolean;
  onModelChange: (value: string) => void;
  onTemperatureChange: (value: string) => void;
  modelPlaceholder: string;
  temperaturePlaceholder: string;
}) {
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
      {mixedModel || mixedTemperature ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-xs leading-5 text-amber-800">
            当前这组里已经存在更细粒度的不同配置。这里如果重新填写，会统一覆盖这一组相关场景；若要分别微调，请展开高级设置。
          </p>
        </div>
      ) : null}
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
    </div>
  );
}

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
  multi_agent_max_steps: "6",
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
  paper_visible_venue_tags: DEFAULT_PAPER_TAG_VISIBILITY_VALUE,
  paper_auto_rename_on_import: "false",
  paper_auto_rename_rule: "{first_author} - {title} ({year})",
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
    description: "根据关键词和上下文类型固定选 agent，最稳定，也最容易复现。",
    note: "这一模式不会调用调度模型，适合你想严格控制成本和行为边界时使用。",
  },
  llm: {
    label: "模型判断",
    description: "由调度模型实时决定该启用哪些 agent，更灵活，也更依赖模型本身。",
    note: "适合复杂提问和开放式任务。建议给调度模型配置快一些、判断力强一些的模型。",
  },
  hybrid: {
    label: "混合判断",
    description: "先用规则确定基础班底，再由调度模型补充和重排，兼顾稳定性和灵活性。",
    note: "这是当前最推荐的模式。研究路线、选题调研这类复合任务会保留关键 agent，再由模型补充额外角色。",
  },
};

const AGENT_GUIDES = [
  { key: "retrieval", label: "检索", description: "先从知识库和论文库找证据，适合需要依据的问题。" },
  { key: "planner", label: "研究规划", description: "拆解研究主题、学习路径和阶段目标。" },
  { key: "literature_scout", label: "文献侦察", description: "先找代表性论文、研究脉络和阅读入口。" },
  { key: "survey", label: "综述组织", description: "把线索整理成结构化综述和趋势判断。" },
  { key: "paper_analyst", label: "论文解析", description: "聚焦单篇论文的方法、实验和局限。" },
  { key: "reproduction", label: "复现建议", description: "聚焦实现细节、实验配置和复现风险。" },
  { key: "synthesis", label: "最终整合", description: "把各专项 agent 的结果整合成最终回答。" },
];

const ROLE_MODEL_CARDS: ModelRoleDefinition[] = [
  {
    title: "方向提示",
    description: "用于研究方向输入过程中的实时提示、关键词补全和下一步字段建议。",
    recommendation: "优先低延迟模型。如果服务商支持联网或搜索能力，这里最适合配置可联网的快模型。",
    fallback: "留空则沿用当前主对话模型。",
    icon: Compass,
    iconColor: "#0A84FF",
    modelKey: "planner_hint_model",
    temperatureKey: "planner_hint_temperature",
    modelPlaceholder: "例如：qwen-turbo / gpt-4.1-mini / 可联网快模型",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "深度规划分析",
    description: "用于理解研究背景、约束和目标，生成更可靠的规划依据。",
    recommendation: "优先旗舰或推理更强的模型，稳定性比速度更重要。",
    fallback: "留空则沿用当前主对话模型。",
    icon: Brain,
    iconColor: "#AF52DE",
    modelKey: "planner_analysis_model",
    temperatureKey: "planner_analysis_temperature",
    modelPlaceholder: "例如：gpt-5 / claude-sonnet / deepseek-reasoner",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "规划结果生成",
    description: "用于输出完整学习路线、阶段任务、论文清单和行动建议。",
    recommendation: "优先长输出质量好的模型。若预算有限，可用均衡型模型承担此角色。",
    fallback: "留空则沿用当前主对话模型。",
    icon: Route,
    iconColor: "#30B0C7",
    modelKey: "planner_generation_model",
    temperatureKey: "planner_generation_temperature",
    modelPlaceholder: "例如：qwen-plus / claude-sonnet / gpt-4.1",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "综述检索规划",
    description: "用于规划调研范围、筛选线索和构建综述骨架。",
    recommendation: "优先速度快、信息覆盖广的模型。如支持联网或学术搜索，会更适合放在这里。",
    fallback: "留空则沿用当前主对话模型。",
    icon: Search,
    iconColor: "#34C759",
    modelKey: "survey_planner_model",
    temperatureKey: "survey_planner_temperature",
    modelPlaceholder: "例如：快模型 / 可联网模型",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "综述写作",
    description: "用于撰写正式的结构化综述、方法对比和趋势总结。",
    recommendation: "优先长上下文、结构化能力强、写作品质稳定的模型。",
    fallback: "留空则沿用当前主对话模型。",
    icon: MessageSquare,
    iconColor: "#FF9F0A",
    modelKey: "survey_writer_model",
    temperatureKey: "survey_writer_temperature",
    modelPlaceholder: "例如：claude-sonnet / qwen-plus / gpt-4.1",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "论文精读",
    description: "用于单篇论文解析、方法拆解、实验理解和局限总结。",
    recommendation: "优先学术理解强、长上下文稳定的模型。",
    fallback: "留空则沿用当前主对话模型。",
    icon: FileSearch,
    iconColor: "#5856D6",
    modelKey: "paper_analysis_model",
    temperatureKey: "paper_analysis_temperature",
    modelPlaceholder: "例如：旗舰模型 / 长上下文模型",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "复现指导",
    description: "用于推断实现要点、训练配置、工程细节和风险点。",
    recommendation: "优先代码和工程理解能力强的模型，通常温度应更低。",
    fallback: "留空则沿用当前主对话模型。",
    icon: Hammer,
    iconColor: "#FF3B30",
    modelKey: "paper_reproduction_model",
    temperatureKey: "paper_reproduction_temperature",
    modelPlaceholder: "例如：代码能力强的模型",
    temperaturePlaceholder: "0.25",
  },
  {
    title: "轻量 Copilot 对话",
    description: "用于关闭多 agent 后的普通对话，或处理日常轻量问题。",
    recommendation: "优先低成本、低延迟模型。复杂任务可改用旗舰模型。",
    fallback: "留空则沿用当前主对话模型。",
    icon: Bot,
    iconColor: "#5AC8FA",
    modelKey: "copilot_simple_model",
    temperatureKey: "copilot_simple_temperature",
    modelPlaceholder: "例如：gpt-4o-mini / qwen-turbo / haiku",
    temperaturePlaceholder: "0.4",
  },
];

const GROUPED_MODEL_CARDS: GroupedModelDefinition[] = [
  {
    title: "快速模型",
    description: "优先响应速度，适合实时提示、调度判断、文献侦察和轻量对话。",
    recommendation: "多数情况下选低延迟模型即可；若服务商支持联网或搜索，也优先放在这一组。",
    affectedScopes: "方向提示、综述检索规划、多 agent 调度、文献侦察、轻量 Copilot 对话",
    icon: Sparkles,
    iconColor: "#0A84FF",
    modelKeys: [
      "planner_hint_model",
      "survey_planner_model",
      "multi_agent_supervisor_model",
      "multi_agent_literature_scout_model",
      "copilot_simple_model",
    ],
    temperatureKeys: [
      "planner_hint_temperature",
      "survey_planner_temperature",
      "multi_agent_supervisor_temperature",
      "multi_agent_literature_scout_temperature",
      "copilot_simple_temperature",
    ],
    modelPlaceholder: "例如：qwen-turbo / gpt-4.1-mini / 可联网快模型",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "深度分析模型",
    description: "优先理解深度，适合研究规划、论文精读和较复杂的分析任务。",
    recommendation: "这里更适合旗舰模型或推理能力强的模型，不必一味追求速度。",
    affectedScopes: "深度规划分析、规划结果生成、论文精读、多 agent 研究规划、多 agent 论文解析",
    icon: Brain,
    iconColor: "#AF52DE",
    modelKeys: [
      "planner_analysis_model",
      "planner_generation_model",
      "paper_analysis_model",
      "multi_agent_planner_model",
      "multi_agent_paper_analyst_model",
    ],
    temperatureKeys: [
      "planner_analysis_temperature",
      "planner_generation_temperature",
      "paper_analysis_temperature",
      "multi_agent_planner_temperature",
      "multi_agent_paper_analyst_temperature",
    ],
    modelPlaceholder: "例如：gpt-5 / claude-sonnet / deepseek-reasoner",
    temperaturePlaceholder: "0.2",
  },
  {
    title: "写作整合模型",
    description: "优先结构化表达和长输出质量，适合正式综述和最终整合。",
    recommendation: "适合长上下文、写作品质稳的模型。预算有限时可选均衡型模型。",
    affectedScopes: "综述写作、多 agent 综述 agent、最终整合回答",
    icon: MessageSquare,
    iconColor: "#FF9F0A",
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
    modelPlaceholder: "例如：claude-sonnet / qwen-plus / gpt-4.1",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "代码复现模型",
    description: "优先代码与工程理解，适合复现建议、训练配置和实现排查。",
    recommendation: "这组通常建议更低温度，减少拍脑袋式推断。",
    affectedScopes: "复现指导、多 agent 复现 agent",
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
    modelPlaceholder: "例如：代码能力强的模型",
    temperaturePlaceholder: "0.25",
  },
];

const ORCHESTRATION_MODEL_CARDS: ModelRoleDefinition[] = [
  {
    title: "调度模型",
    description: "只负责判断该启用哪些 agent，不负责生成最终答案。",
    recommendation: "优先反应快、判断稳定的模型。调度阶段通常不需要最贵的旗舰模型。",
    fallback: "仅在模型判断或混合判断模式下生效。留空则沿用主对话模型。",
    icon: Brain,
    iconColor: "#AF52DE",
    modelKey: "multi_agent_supervisor_model",
    temperatureKey: "multi_agent_supervisor_temperature",
    modelPlaceholder: "例如：qwen-plus / gpt-4.1-mini",
    temperaturePlaceholder: "0.1",
  },
  {
    title: "默认执行模型",
    description: "作为多 agent 中各专项 agent 的统一默认模型。",
    recommendation: "优先均衡型模型，兼顾成本、速度和学术理解能力。",
    fallback: "各专项 agent 可单独覆盖；留空则沿用主对话模型。",
    icon: Bot,
    iconColor: "#34C759",
    modelKey: "multi_agent_worker_model",
    temperatureKey: "multi_agent_worker_temperature",
    modelPlaceholder: "例如：qwen-plus / gpt-4.1 / claude-sonnet",
    temperaturePlaceholder: "0.3",
  },
  {
    title: "最终整合模型",
    description: "负责把多个 agent 的中间结果整理成最终中文答复。",
    recommendation: "优先长输出质量好、整合能力强的模型，必要时可以用旗舰模型。",
    fallback: "留空则沿用主对话模型。",
    icon: Sparkles,
    iconColor: "#0A84FF",
    modelKey: "multi_agent_synthesis_model",
    temperatureKey: "multi_agent_synthesis_temperature",
    modelPlaceholder: "例如：旗舰模型 / 写作质量强的模型",
    temperaturePlaceholder: "0.4",
  },
];

const SPECIALIST_OVERRIDE_CARDS: ModelRoleDefinition[] = [
  {
    title: "研究规划 agent",
    description: "多 agent 对话里负责拆解研究路线、学习路径和行动建议。",
    recommendation: "如果你希望规划类问题明显更强，可在这里单独指定更强的模型。",
    fallback: "留空则继承默认执行模型；仍为空时再回退到主对话模型。",
    icon: Route,
    iconColor: "#30B0C7",
    modelKey: "multi_agent_planner_model",
    temperatureKey: "multi_agent_planner_temperature",
    modelPlaceholder: "例如：更强推理模型",
    temperaturePlaceholder: "留空继承",
  },
  {
    title: "文献侦察 agent",
    description: "负责快速找论文线索、核心工作和调研入口。",
    recommendation: "若服务商支持联网或搜索，这里最适合分配快且能检索外部信息的模型。",
    fallback: "留空则继承默认执行模型；仍为空时再回退到主对话模型。",
    icon: Search,
    iconColor: "#34C759",
    modelKey: "multi_agent_literature_scout_model",
    temperatureKey: "multi_agent_literature_scout_temperature",
    modelPlaceholder: "例如：可联网快模型",
    temperaturePlaceholder: "留空继承",
  },
  {
    title: "综述 agent",
    description: "负责把文献线索整理成结构化领域综述。",
    recommendation: "适合分配长上下文和写作质量更稳定的模型。",
    fallback: "留空则继承默认执行模型；仍为空时再回退到主对话模型。",
    icon: MessageSquare,
    iconColor: "#FF9F0A",
    modelKey: "multi_agent_survey_model",
    temperatureKey: "multi_agent_survey_temperature",
    modelPlaceholder: "例如：长上下文写作模型",
    temperaturePlaceholder: "留空继承",
  },
  {
    title: "论文解析 agent",
    description: "负责单篇论文理解、方法拆解和实验解读。",
    recommendation: "适合分配更擅长学术分析和细节理解的模型。",
    fallback: "留空则继承默认执行模型；仍为空时再回退到主对话模型。",
    icon: FileSearch,
    iconColor: "#5856D6",
    modelKey: "multi_agent_paper_analyst_model",
    temperatureKey: "multi_agent_paper_analyst_temperature",
    modelPlaceholder: "例如：旗舰模型 / 长上下文模型",
    temperaturePlaceholder: "留空继承",
  },
  {
    title: "复现 agent",
    description: "负责实现路径、训练配置、复现实验和工程风险。",
    recommendation: "适合分配代码能力更强、温度更低的模型。",
    fallback: "留空则继承默认执行模型；仍为空时再回退到主对话模型。",
    icon: Hammer,
    iconColor: "#FF3B30",
    modelKey: "multi_agent_reproduction_model",
    temperatureKey: "multi_agent_reproduction_temperature",
    modelPlaceholder: "例如：代码能力强的模型",
    temperaturePlaceholder: "留空继承",
  },
];

type SaveState = "idle" | "saving" | "saved" | "error";
type TestState = "idle" | "testing" | "ok" | "error";
type UpdateState = "idle" | "checking" | "ready" | "latest" | "installing" | "disabled" | "error";

function formatUpdateDate(value?: string) {
  if (!value) {
    return "";
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("connection");

  const set = (key: keyof AppSettings) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setMany = (keys: (keyof AppSettings)[]) => (value: string) =>
    setForm((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        next[key] = value;
      });
      return next;
    });

  const getSharedValue = (keys: (keyof AppSettings)[]) => {
    const values = keys
      .map((key) => form[key].trim())
      .filter(Boolean);
    if (values.length === 0) {
      return "";
    }
    return new Set(values).size === 1 ? values[0] : "";
  };

  const hasMixedValue = (keys: (keyof AppSettings)[]) => {
    const values = keys
      .map((key) => form[key].trim())
      .filter(Boolean);
    return new Set(values).size > 1;
  };

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const data = await apiClient.settings.get();
        if (!cancelled) {
          setForm({ ...DEFAULT_SETTINGS, ...data });
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
  const updatePublishedAt = formatUpdateDate(updateInfo?.pub_date);

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-nm-dark/10"
        style={{ background: "#EEF1F5" }}
      >
        <div>
          <h1 className="text-lg font-bold text-ink-primary leading-tight">设置</h1>
          <p className="text-xs text-ink-tertiary">按用途配置模型、检索和多 agent 协作策略</p>
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
            {testMsg ? (
              <span
                className={`absolute top-full left-0 mt-0.5 text-xs whitespace-nowrap ${
                  testState === "error" ? "text-red-500" : "text-green-600"
                }`}
              >
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                <h2 className="text-sm font-semibold text-ink-primary">主模型连接</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  这里配置默认对话模型。下面各个场景如果留空，会按继承规则回退到这里。
                </p>
              </div>
            </div>

            {!contentUnavailable ? (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-ink-tertiary ml-1">模型服务商</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["openai_compatible", "openai", "anthropic"] as LlmProvider[]).map((item) => (
                      <ProviderTab
                        key={item}
                        label={
                          item === "openai_compatible"
                            ? "兼容接口"
                            : item === "openai"
                              ? "OpenAI"
                              : "Anthropic"
                        }
                        active={provider === item}
                        onClick={() => set("llm_provider")(item)}
                      />
                    ))}
                  </div>
                </div>

                {provider === "openai_compatible" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <SettingInput
                      label="接口地址"
                      value={form.openai_compatible_base_url}
                      onChange={set("openai_compatible_base_url")}
                      placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                      hint="阿里云、硅基流动、DeepSeek、Moonshot 等兼容接口都可以接在这里。"
                    />
                    <SettingInput
                      label="接口密钥"
                      value={form.openai_compatible_api_key}
                      onChange={set("openai_compatible_api_key")}
                      placeholder="sk-..."
                      sensitive
                      hint={`留空或输入 ${MASK} 表示不更改`}
                    />
                    <SettingInput
                      label="默认对话模型"
                      value={form.openai_compatible_chat_model}
                      onChange={set("openai_compatible_chat_model")}
                      placeholder="qwen-plus / deepseek-chat"
                    />
                    <SettingInput
                      label="默认向量模型"
                      value={form.openai_compatible_embedding_model}
                      onChange={set("openai_compatible_embedding_model")}
                      placeholder="BAAI/bge-m3"
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
                  <h2 className="text-sm font-semibold text-ink-primary">导入 PDF 自动重命名</h2>
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
              <SectionIcon icon={Layers3} color="#0A84FF" />
              <div>
                <h2 className="text-sm font-semibold text-ink-primary">常用模型分工</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  默认只保留最常用的 4 组模型。大多数情况下，配好这里就够用，不需要逐项微调。
                </p>
              </div>
            </div>

            <RecommendationList
              items={[
                "如果你不想配太多模型，通常只需要主模型、快速模型、深度分析模型和写作整合模型。",
                "这 4 组模型会自动覆盖对应功能和多 agent 场景；你只有在想精细控制时，才需要展开高级设置。",
                "所有分组都支持留空继承，所以完全可以只填其中一两项。",
                "如果你已经在高级设置里做过细分，这里会提醒“已细分配置”；重新填写会统一覆盖这一组。",
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              {GROUPED_MODEL_CARDS.map((item) => (
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
                  mixedModel={hasMixedValue(item.modelKeys)}
                  mixedTemperature={hasMixedValue(item.temperatureKeys)}
                  onModelChange={setMany(item.modelKeys)}
                  onTemperatureChange={setMany(item.temperatureKeys)}
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
                <h2 className="text-sm font-semibold text-ink-primary">多 agent 编排</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  默认会继承上面的常用模型分工。只有你想精细控制每个 agent 时，才需要展开高级设置。
                </p>
              </div>
            </div>

            <ToggleRow
              title="启用多 agent 编排"
              description="关闭后只使用轻量 Copilot 对话模型，不再拆分任务，也不展示中间 agent 过程。"
              checked={form.multi_agent_enabled === "true"}
              onToggle={() =>
                set("multi_agent_enabled")(form.multi_agent_enabled === "true" ? "false" : "true")
              }
            />

            <div className="space-y-2">
              <label className="block text-xs font-medium text-ink-tertiary ml-1">选路方式</label>
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

            <RecommendationList
              items={[
                "推荐直接用混合判断。多数用户不需要手动调整到每个 agent 的模型级别。",
                "默认继承关系是：专项 agent 覆盖值 -> 常用模型分工 -> 默认执行模型 -> 主模型。",
                "如果你只是想让文献侦察用快模型、论文解析用强模型，通常只改上面的常用模型分工就够了。",
                "只有在做成本压缩、AB 测试或特定 agent 调优时，才建议展开高级设置。",
              ]}
            />

            <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-primary">高级设置</p>
                  <p className="text-xs text-ink-tertiary mt-1 leading-5">
                    这里包含逐个场景模型、默认执行模型、专项 agent 覆盖、agent 开关和步数限制。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((value) => !value)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-150"
                  style={{
                    background: "#E8ECF0",
                    color: "#3C3C43",
                    boxShadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
                  }}
                >
                  {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {showAdvanced ? "收起高级设置" : "展开高级设置"}
                </button>
              </div>
            </div>

            {showAdvanced ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#1A8AFF]" />
                    <p className="text-sm font-semibold text-ink-primary">逐项场景模型</p>
                  </div>
                  <p className="text-xs text-ink-tertiary leading-5">
                    如果你想让某个具体功能使用不同模型，比如单独调整“方向提示”或“轻量对话”，在这里设置。
                  </p>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {ROLE_MODEL_CARDS.map((item) => (
                      <ModelRoleCard
                        key={item.title}
                        icon={item.icon}
                        iconColor={item.iconColor}
                        title={item.title}
                        description={item.description}
                        recommendation={item.recommendation}
                        fallback={item.fallback}
                        modelValue={form[item.modelKey]}
                        onModelChange={set(item.modelKey)}
                        modelPlaceholder={item.modelPlaceholder}
                        temperatureValue={form[item.temperatureKey]}
                        onTemperatureChange={set(item.temperatureKey)}
                        temperaturePlaceholder={item.temperaturePlaceholder}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-[#1A8AFF]" />
                    <p className="text-sm font-semibold text-ink-primary">多 agent 细项</p>
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
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {AGENT_GUIDES.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-3 py-3">
                          <p className="text-xs font-semibold text-ink-primary">{item.label}</p>
                          <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <SettingInput
                      label="单次最多调用的专项 agent 数"
                      value={form.multi_agent_max_steps}
                      onChange={set("multi_agent_max_steps")}
                      placeholder="6"
                    />
                    <SettingInput
                      label="文献检索条数上限"
                      value={form.multi_agent_search_limit}
                      onChange={set("multi_agent_search_limit")}
                      placeholder="8"
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    {ORCHESTRATION_MODEL_CARDS.map((item) => (
                      <ModelRoleCard
                        key={item.title}
                        icon={item.icon}
                        iconColor={item.iconColor}
                        title={item.title}
                        description={item.description}
                        recommendation={item.recommendation}
                        fallback={item.fallback}
                        modelValue={form[item.modelKey]}
                        onModelChange={set(item.modelKey)}
                        modelPlaceholder={item.modelPlaceholder}
                        temperatureValue={form[item.temperatureKey]}
                        onTemperatureChange={set(item.temperatureKey)}
                        temperaturePlaceholder={item.temperaturePlaceholder}
                      />
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-ink-primary">专项 agent 覆盖</p>
                    <p className="text-xs text-ink-tertiary leading-5">
                      只在你明确知道某个 agent 需要不同模型时填写，比如让文献侦察走快模型、论文解析走旗舰模型。
                    </p>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {SPECIALIST_OVERRIDE_CARDS.map((item) => (
                        <ModelRoleCard
                          key={item.title}
                          icon={item.icon}
                          iconColor={item.iconColor}
                          title={item.title}
                          description={item.description}
                          recommendation={item.recommendation}
                          fallback={item.fallback}
                          modelValue={form[item.modelKey]}
                          onModelChange={set(item.modelKey)}
                          modelPlaceholder={item.modelPlaceholder}
                          temperatureValue={form[item.temperatureKey]}
                          onTemperatureChange={set(item.temperatureKey)}
                          temperaturePlaceholder={item.temperaturePlaceholder}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
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
                    <p className="mt-1 text-sm font-semibold text-ink-primary">{updateInfo?.current_version ?? "待检查"}</p>
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

              <p className="text-[11px] leading-5 text-ink-tertiary">
                如果这里一直显示“未配置升级源”，说明当前构建没有注入更新地址或公钥。开发环境通常如此，正式发布版由 CI 在构建时写入。
              </p>
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
                  "多 agent 的专项覆盖只影响多 agent 对话流程，不影响独立功能页的模型选择。",
                  "如果你刚开始配置，建议先填主对话模型、方向提示模型和最终整合模型，其他项之后再细化。",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
                    <p className="text-xs leading-5 text-ink-secondary">{item}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
