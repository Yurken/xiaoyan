import type { AppSettings } from "@research-copilot/types";
import { CHARACTERISTIC_MODEL_CARDS } from "./shared";

/**
 * 配置预设 — 一键为所有角色模型分配推荐配置
 *
 * 每个预设只覆盖 model + temperature，不影响 base_url / api_key。
 * 用户仍可手动修改任何字段，预设只是起点。
 */

export type ModelPresetId = "economy" | "balanced" | "performance";

export interface ModelPreset {
  id: ModelPresetId;
  label: string;
  description: string;
  icon: string;
  /** 模型分配: role key → model name */
  models: Partial<Record<keyof AppSettings, string>>;
  /** 温度分配: role key → temperature string */
  temperatures: Partial<Record<keyof AppSettings, string>>;
}

/**
 * 经济模式 — 全用同一快模型，成本最低
 * 适合：日常问答、简单检索、不需要深度推理的场景
 */
const economyPreset: ModelPreset = {
  id: "economy",
  label: "经济模式",
  description: "全部角色使用同一快模型，成本最低，适合日常问答。",
  icon: "💰",
  models: {
    // 流光 + 小妍回退
    planner_hint_model: "",
    copilot_simple_model: "",
    multi_agent_worker_model: "",
    // 谋策 — 用同一快模型
    multi_agent_supervisor_model: "",
    planner_analysis_model: "",
    planner_generation_model: "",
    multi_agent_planner_model: "",
    // 探知
    multi_agent_literature_scout_model: "",
    survey_planner_model: "",
    // 洞见
    paper_analysis_model: "",
    multi_agent_paper_analyst_model: "",
    // 翰章
    survey_writer_model: "",
    multi_agent_survey_model: "",
    multi_agent_synthesis_model: "",
    // 构域
    paper_reproduction_model: "",
    multi_agent_reproduction_model: "",
    // 视界 + 译衡
    vision_model: "",
    translation_model: "",
  },
  temperatures: {
    planner_hint_temperature: "0.3",
    copilot_simple_temperature: "0.4",
    multi_agent_worker_temperature: "0.3",
    multi_agent_supervisor_temperature: "0.2",
    planner_analysis_temperature: "0.2",
    planner_generation_temperature: "0.3",
    multi_agent_planner_temperature: "0.2",
    multi_agent_literature_scout_temperature: "0.2",
    survey_planner_temperature: "0.2",
    paper_analysis_temperature: "0.3",
    multi_agent_paper_analyst_temperature: "0.3",
    survey_writer_temperature: "0.3",
    multi_agent_survey_temperature: "0.3",
    multi_agent_synthesis_temperature: "0.4",
    paper_reproduction_temperature: "0.25",
    multi_agent_reproduction_temperature: "0.25",
    vision_temperature: "0.2",
    translation_temperature: "0.1",
  },
};

/**
 * 均衡模式 — 快模型做轻量、中端模型做推理和写作
 */
const balancedPreset: ModelPreset = {
  id: "balanced",
  label: "均衡模式",
  description: "快模型做轻量应答，中端模型做推理和写作，性价比最优。",
  icon: "⚖️",
  models: {
    // 流光 — 快模型
    planner_hint_model: "deepseek-chat",
    copilot_simple_model: "deepseek-chat",
    // 谋策 — 中端推理
    multi_agent_supervisor_model: "deepseek-chat",
    planner_analysis_model: "deepseek-chat",
    planner_generation_model: "deepseek-chat",
    multi_agent_planner_model: "deepseek-chat",
    // 小妍回退 — 中端
    multi_agent_worker_model: "deepseek-chat",
    // 探知 — 快模型
    multi_agent_literature_scout_model: "deepseek-chat",
    survey_planner_model: "deepseek-chat",
    // 洞见 — 中端
    paper_analysis_model: "deepseek-chat",
    multi_agent_paper_analyst_model: "deepseek-chat",
    // 翰章 — 中端
    survey_writer_model: "deepseek-chat",
    multi_agent_survey_model: "deepseek-chat",
    multi_agent_synthesis_model: "deepseek-chat",
    // 构域 — 中端
    paper_reproduction_model: "deepseek-chat",
    multi_agent_reproduction_model: "deepseek-chat",
    // 视界 + 译衡 — 留空回退主模型
    vision_model: "",
    translation_model: "",
  },
  temperatures: {
    planner_hint_temperature: "0.2",
    copilot_simple_temperature: "0.4",
    multi_agent_worker_temperature: "0.3",
    multi_agent_supervisor_temperature: "0.1",
    planner_analysis_temperature: "0.2",
    planner_generation_temperature: "0.3",
    multi_agent_planner_temperature: "0.2",
    multi_agent_literature_scout_temperature: "0.2",
    survey_planner_temperature: "0.2",
    paper_analysis_temperature: "0.3",
    multi_agent_paper_analyst_temperature: "0.3",
    survey_writer_temperature: "0.3",
    multi_agent_survey_temperature: "0.3",
    multi_agent_synthesis_temperature: "0.4",
    paper_reproduction_temperature: "0.25",
    multi_agent_reproduction_temperature: "0.25",
    vision_temperature: "0.2",
    translation_temperature: "0.1",
  },
};

/**
 * 高性能模式 — 旗舰推理模型做规划和分析，快模型做检索和轻量任务
 */
const performancePreset: ModelPreset = {
  id: "performance",
  label: "高性能模式",
  description: "旗舰推理模型做规划和分析，快模型做检索，效果最优。",
  icon: "🚀",
  models: {
    // 流光 — 快模型
    planner_hint_model: "deepseek-chat",
    copilot_simple_model: "deepseek-chat",
    // 谋策 — 旗舰推理
    multi_agent_supervisor_model: "deepseek-reasoner",
    planner_analysis_model: "deepseek-reasoner",
    planner_generation_model: "deepseek-reasoner",
    multi_agent_planner_model: "deepseek-reasoner",
    // 小妍回退
    multi_agent_worker_model: "deepseek-chat",
    // 探知 — 快模型
    multi_agent_literature_scout_model: "deepseek-chat",
    survey_planner_model: "deepseek-chat",
    // 洞见 — 旗舰
    paper_analysis_model: "deepseek-reasoner",
    multi_agent_paper_analyst_model: "deepseek-reasoner",
    // 翰章 — 旗舰
    survey_writer_model: "deepseek-reasoner",
    multi_agent_survey_model: "deepseek-reasoner",
    multi_agent_synthesis_model: "deepseek-reasoner",
    // 构域 — 旗舰
    paper_reproduction_model: "deepseek-reasoner",
    multi_agent_reproduction_model: "deepseek-reasoner",
    // 视界 — 多模态旗舰
    vision_model: "gpt-4o",
    // 译衡 — 中端
    translation_model: "deepseek-chat",
  },
  temperatures: {
    planner_hint_temperature: "0.2",
    copilot_simple_temperature: "0.4",
    multi_agent_worker_temperature: "0.3",
    multi_agent_supervisor_temperature: "0.1",
    planner_analysis_temperature: "0.1",
    planner_generation_temperature: "0.2",
    multi_agent_planner_temperature: "0.1",
    multi_agent_literature_scout_temperature: "0.2",
    survey_planner_temperature: "0.2",
    paper_analysis_temperature: "0.2",
    multi_agent_paper_analyst_temperature: "0.2",
    survey_writer_temperature: "0.25",
    multi_agent_survey_temperature: "0.25",
    multi_agent_synthesis_temperature: "0.3",
    paper_reproduction_temperature: "0.2",
    multi_agent_reproduction_temperature: "0.2",
    vision_temperature: "0.2",
    translation_temperature: "0.1",
  },
};

export const MODEL_PRESETS: ModelPreset[] = [
  economyPreset,
  balancedPreset,
  performancePreset,
];

/**
 * 检测当前设置匹配哪个预设
 * 如果所有 model key 都匹配某预设的 models，则返回该 preset id
 * 否则返回 null（自定义）
 */
export function detectModelPreset(form: AppSettings): ModelPresetId | null {
  for (const preset of MODEL_PRESETS) {
    const allMatch = Object.entries(preset.models).every(
      ([key, expectedModel]) => {
        const current = form[key as keyof AppSettings];
        return current === expectedModel;
      },
    );
    if (allMatch) return preset.id;
  }
  return null;
}

/**
 * 应用预设到 form，返回需要更新的 key-value 对
 * 只覆盖 model + temperature，不影响 base_url / api_key
 */
export function applyModelPreset(
  presetId: ModelPresetId,
): Partial<Record<keyof AppSettings, string>> {
  const preset = MODEL_PRESETS.find((p) => p.id === presetId);
  if (!preset) return {};

  return {
    ...preset.models,
    ...preset.temperatures,
  };
}

/**
 * 检查某角色卡片是否使用了非默认值（有自定义 model 或 base_url）
 */
export function isCardCustomized(
  form: AppSettings,
  card: (typeof CHARACTERISTIC_MODEL_CARDS)[number],
): boolean {
  return (
    card.modelKeys.some((k) => form[k] !== "") ||
    card.baseUrlKeys.some((k) => form[k] !== "") ||
    card.apiKeyKeys.some((k) => form[k] !== "" && form[k] !== "***")
  );
}

/**
 * 获取卡片的简短状态描述
 */
export function getCardStatusSummary(
  form: AppSettings,
  card: (typeof CHARACTERISTIC_MODEL_CARDS)[number],
): string {
  const modelVal = form[card.modelKeys[0]];
  if (modelVal) return modelVal;

  const hasCustomEndpoint = card.baseUrlKeys.some((k) => form[k] !== "");
  if (hasCustomEndpoint) return "自定义接口";

  return "沿用主模型";
}
