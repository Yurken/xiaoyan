import { useState, type ComponentType } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  FileSearch,
  Hammer,
  Languages,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import type { AppSettings, MultiAgentRoutingMode } from "@research-copilot/types";

export const MASK = "***";

export function SettingInput({
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
        {sensitive ? (
          <button
            type="button"
            onClick={() => setShow((state) => !state)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-ink-tertiary ml-1 leading-5">{hint}</p> : null}
    </div>
  );
}

export function SectionIcon({
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

export function AgentChip({
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

export function ProviderTab({
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

export function ToggleRow({
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
        style={{ background: checked ? "#34C759" : "var(--rc-chip-inset-bg)" }}
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

export function RecommendationList({ items }: { items: string[] }) {
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

export type GroupedModelDefinition = {
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

export function GroupedModelCard({
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
          hint="留空则沿用上方主模型。"
        />
        <SettingInput
          label={secondaryFieldLabel ?? "统一温度"}
          value={temperatureValue}
          onChange={onTemperatureChange}
          placeholder={temperaturePlaceholder}
          hint={secondaryFieldHint ?? "留空沿用现有温度，填写则统一覆盖。"}
        />
      </div>
      <button
        type="button"
        onClick={() => setShowAdvanced((value) => !value)}
        className="flex items-center gap-1.5 text-xs text-ink-tertiary hover:text-ink-secondary transition-colors"
      >
        {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {showAdvanced ? "收起独立接口配置" : "展开独立接口配置（Base URL / API Key）"}
      </button>
      {showAdvanced ? (
        <div className="grid gap-3 pt-1 border-t border-nm-dark/10">
          {mixedBaseUrl || mixedApiKey ? (
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
            hint="为该组单独指定接口地址。"
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

export const AGENT_OPTIONS = [
  ["planner", "谋策模型"],
  ["retrieval", "溯源模型"],
  ["literature_scout", "探知模型"],
  ["paper_analyst", "洞见模型"],
  ["survey", "翰章模型"],
  ["reproduction", "构域模型"],
  ["synthesis", "整合模型"],
] as const;

export const ROUTING_MODE_COPY: Record<MultiAgentRoutingMode, { label: string; description: string; note: string }> = {
  rule: {
    label: "规则判断",
    description: "根据关键词和上下文类型固定选择小妍步骤，最稳定，也最容易复现。",
    note: "这一模式不会调用调度模型，适合你想严格控制成本和行为边界时使用。",
  },
  llm: {
    label: "模型判断",
    description: "由调度模型实时决定该启用哪些小妍步骤，更灵活，也更依赖模型本身。",
    note: "适合复杂提问和开放式任务。建议给调度模型配置快一些、判断力强一些的模型。",
  },
  hybrid: {
    label: "混合判断",
    description: "先用规则确定基础班底，再由调度模型补充和重排，兼顾稳定性和灵活性。",
    note: "这是当前最推荐的模式。研究路线、选题调研这类复合任务会保留关键小妍步骤，再由模型补充额外分工。",
  },
};

export const AGENT_GUIDES = [
  { key: "planner", label: "谋策模型", description: "拆解研究主题、学习路径和阶段目标。" },
  { key: "retrieval", label: "溯源模型", description: "先从知识库和论文库找证据，适合需要依据的问题。" },
  { key: "literature_scout", label: "探知模型", description: "先找代表性论文、研究脉络和阅读入口。" },
  { key: "paper_analyst", label: "洞见模型", description: "聚焦单篇论文的方法、实验和局限。" },
  { key: "survey", label: "翰章模型", description: "把线索整理成结构化综述和趋势判断。" },
  { key: "reproduction", label: "构域模型", description: "聚焦实现细节、实验配置和复现风险。" },
  { key: "synthesis", label: "整合模型", description: "把各小妍步骤的结果整合成最终回答。" },
];

export const CHARACTERISTIC_MODEL_CARDS: GroupedModelDefinition[] = [
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
  {
    title: "谋策 · 规划",
    description: "具备极强逻辑推理与拆解能力，负责深度调度与研究思路分析。",
    recommendation: "这里更适合旗舰推理模型，不必追求速度，准确性和逻辑性优先。",
    affectedScopes: "小妍步骤调度、研究规划分析与生成",
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
    title: "溯源 · 向量化与检索",
    description: "负责知识库向量化、语义检索与 RAG 证据回溯。",
    recommendation: "优先选稳定的 embedding 模型；检索数量建议 5-8。",
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
    recommendation: "若服务商支持联网或内置搜索工具，优先接在这里；否则可填与“流光”相同的快模型。",
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
  {
    title: "洞见 · 深度总结",
    description: "擅长长文本阅读与核心结论提炼。",
    recommendation: "优先选上下文窗口大、长文阅读能力强的模型。",
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
    description: "扫描 PDF 中的图表、架构图与公式截图。",
    recommendation: "需要多模态能力，推荐 GPT-4o / Gemini / Claude Sonnet 等支持图像输入的模型。",
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
    description: "中英学术互译，要求忠实原文、温度极低。",
    recommendation: "忠实度优先于流畅度，建议选专注翻译的模型，温度 ≤ 0.1。",
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
