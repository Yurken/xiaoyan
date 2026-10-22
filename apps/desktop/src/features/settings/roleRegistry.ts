/**
 * 小妍角色模型注册表 —— 角色配置的单一事实来源。
 *
 * 每个角色把「哪些设置键共同描述这一个任务」集中声明在这里；设置页卡片、
 * 状态判定与预设都从本表派生，不再各自维护一份角色清单。
 *
 * 分层约定（`tier`）：
 * - `primary`：需要用户明确决定的硬能力边界（视觉、向量化），默认展开。
 * - `advanced`：纯文本任务的成本 / 延迟微调，默认折叠在「高级：按任务指定模型」中。
 *   这类角色留空即继承主模型，普通用户不需要看到。
 *
 * 与后端的一致性：键名必须存在于 `AppSettings`；角色的回退语义由
 * `src-tauri/src/llm/client_resolution.rs` 实现——角色模型留空 = 完全继承主模型。
 */

import {
  Brain,
  Database,
  Eye,
  FileSearch,
  Hammer,
  Languages,
  MessageSquare,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { AppSettings } from "@research-copilot/types";

/**
 * 一个任务角色的模型配置定义。
 *
 * 同一角色的多个键指向同一件事的不同调用点（例如"洞见"同时服务论文精读与
 * 多智能体分析步骤），因此按角色分组、按组读写，避免逐键漂移。
 */
export interface ModelRoleCard {
  /** 稳定标识，用于折叠状态与测试状态，不随展示文案变化。 */
  id: string;
  /** 默认是否展开；`primary` 为硬能力边界。 */
  tier: "primary" | "advanced";
  title: string;
  description: string;
  recommendation: string;
  affectedScopes: string;
  icon: LucideIcon;
  iconColor: string;
  modelKeys: (keyof AppSettings)[];
  temperatureKeys: (keyof AppSettings)[];
  baseUrlKeys: (keyof AppSettings)[];
  apiKeyKeys: (keyof AppSettings)[];
  modelPlaceholder: string;
  temperaturePlaceholder: string;
  secondaryFieldLabel?: string;
  secondaryFieldHint?: string;
}

export const CHARACTERISTIC_MODEL_CARDS: ModelRoleCard[] = [
  {
    title: "流光 · 快速响应",
    id: "quick-reply",
    tier: "advanced",
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
    id: "planning",
    tier: "advanced",
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
    id: "embedding",
    tier: "primary",
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
    id: "search",
    tier: "advanced",
    description: "为“文献侦察、综述检索规划”角色指定的推理模型，处理强外部信息依赖的场景。",
    recommendation: "建议这里接一个自带联网/搜索能力的模型（API）效果最好；没有就留空不动即可（沿用默认模型）。接了能联网的模型后，它既可以替代“小妍联网搜索来源”（DuckDuckGo / Tavily），也可以与之互为补充。",
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
    id: "analysis",
    tier: "advanced",
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
    id: "writing",
    tier: "advanced",
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
    id: "code",
    tier: "advanced",
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
    id: "vision",
    tier: "primary",
    description: "扫描 PDF 图表，以及在小妍对话中读取你发送的图片。",
    recommendation: "需要多模态能力，推荐 GPT-4o / Gemini / Claude Sonnet 等支持图像输入的模型。",
    affectedScopes: "论文图表扫描、小妍对话发送图片（未配置时无法在对话中发图）",
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
    id: "translation",
    tier: "advanced",
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

/** 默认展开的槽位：主模型之外，用户必须显式决定的硬能力边界。 */
export const PRIMARY_ROLE_CARDS = CHARACTERISTIC_MODEL_CARDS.filter(
  (card) => card.tier === "primary",
);

/** 默认折叠的高级槽位：留空即继承主模型，只影响成本与延迟。 */
export const ADVANCED_ROLE_CARDS = CHARACTERISTIC_MODEL_CARDS.filter(
  (card) => card.tier === "advanced",
);

/**
 * 不出卡片、但同样参与角色解析的兜底角色。
 *
 * `multi_agent_worker_model` 是多智能体与部分回退链的兜底模型
 * （见 `agent_nodes.rs`、`commands/papers.rs`），没有独立的用户任务入口，因此不出卡片；
 * 但它同样遵守"留空 = 继承主模型"，必须纳入统一操作，否则"全部沿用主模型"
 * 会漏掉一个角色。主服务商自带的 chat / embedding 模型键不属于角色，不在此列。
 */
const CARD_LESS_ROLES = [
  {
    modelKeys: ["multi_agent_worker_model"] as (keyof AppSettings)[],
    temperatureKeys: ["multi_agent_worker_temperature"] as (keyof AppSettings)[],
  },
];

/** 所有角色的模型键，用于把全部任务统一回主模型。 */
export const ALL_ROLE_MODEL_KEYS: (keyof AppSettings)[] = [
  ...CHARACTERISTIC_MODEL_CARDS.flatMap((card) => card.modelKeys),
  ...CARD_LESS_ROLES.flatMap((role) => role.modelKeys),
];

/** 所有角色的采样参数键，用于批量恢复推荐参数。 */
export const ALL_ROLE_TEMPERATURE_KEYS: (keyof AppSettings)[] = [
  ...CHARACTERISTIC_MODEL_CARDS.flatMap((card) => card.temperatureKeys),
  ...CARD_LESS_ROLES.flatMap((role) => role.temperatureKeys),
];

/**
 * 角色是否已完全沿用主模型。
 *
 * 判定只看模型键：按 `client_resolution.rs` 的约定，模型留空即继承主模型，
 * 残留的 base_url / api_key 不再生效，因此不能作为"已自定义"的依据。
 */
export function isRoleCardInherited(form: AppSettings, card: ModelRoleCard): boolean {
  return card.modelKeys.every((key) => !String(form[key] ?? "").trim());
}

/** 卡片是否被用户改过模型（端点残留不算，见 `isRoleCardInherited`）。 */
export function isCardCustomized(form: AppSettings, card: ModelRoleCard): boolean {
  return !isRoleCardInherited(form, card);
}

/** 卡片的简短状态描述。 */
export function getCardStatusSummary(form: AppSettings, card: ModelRoleCard): string {
  const modelVal = card.modelKeys
    .map((key) => String(form[key] ?? "").trim())
    .find((value) => value !== "");
  if (modelVal) return modelVal;
  return "沿用主模型";
}

/**
 * 是否所有任务都已统一到主模型。
 *
 * 这是"统一任务分工"的唯一判定入口：只要还有任意角色指定了模型，就不算统一。
 */
export function isFullyUnified(form: AppSettings): boolean {
  return ALL_ROLE_MODEL_KEYS.every((key) => !String(form[key] ?? "").trim());
}

/** 当前有多少个角色仍指定了独立模型。 */
export function countSpecializedRoles(form: AppSettings): number {
  return ALL_ROLE_MODEL_KEYS.filter((key) => String(form[key] ?? "").trim() !== "").length;
}
