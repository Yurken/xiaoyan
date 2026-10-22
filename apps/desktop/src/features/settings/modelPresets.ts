import type { AppSettings } from "@research-copilot/types";
import { ALL_ROLE_MODEL_KEYS, CHARACTERISTIC_MODEL_CARDS, isFullyUnified } from "./roleRegistry";

/**
 * 一键对齐操作。
 *
 * 这里刻意不写任何厂商模型名：小妍的用户可以接任意 OpenAI / Anthropic 兼容端点，
 * 把 `deepseek-chat` 这类名字烧进预设，会在他们换端点或换模型后永久失配
 * （旧实现用全等匹配判断预设是否生效，一次改动就再也匹配不上）。
 * 因此预设只表达与厂商无关的意图：「回到主模型」或「恢复推荐采样参数」。
 */

export type ModelPresetId = "inherit-main" | "recommended-params";

export interface ModelPreset {
  id: ModelPresetId;
  label: string;
  description: string;
  /** 一次写入的设置键；只覆盖明确属于该意图的键。 */
  updates: Partial<Record<keyof AppSettings, string>>;
}

type SettingUpdate = [keyof AppSettings, string];

const toUpdates = (entries: SettingUpdate[]): Partial<Record<keyof AppSettings, string>> =>
  Object.fromEntries(entries) as Partial<Record<keyof AppSettings, string>>;

/** 推荐采样参数直接取自角色注册表的占位值，避免再维护第三份清单。 */
const recommendedTemperatures = toUpdates(
  CHARACTERISTIC_MODEL_CARDS.flatMap((card) =>
    card.temperatureKeys.map((key): SettingUpdate => [key, card.temperaturePlaceholder]),
  ),
);

const inheritMainPreset: ModelPreset = {
  id: "inherit-main",
  label: "全部沿用主模型",
  description: "所有任务都交给上方主模型，配置最简单。",
  updates: toUpdates(ALL_ROLE_MODEL_KEYS.map((key): SettingUpdate => [key, ""])),
};

const recommendedParamsPreset: ModelPreset = {
  id: "recommended-params",
  label: "恢复推荐参数",
  description: "保留你指定的模型，只把温度等采样参数恢复成推荐值。",
  updates: recommendedTemperatures,
};

export const MODEL_PRESETS: ModelPreset[] = [inheritMainPreset, recommendedParamsPreset];

/** 应用预设，返回需要写入的设置键值对。 */
export function applyModelPreset(
  presetId: ModelPresetId,
): Partial<Record<keyof AppSettings, string>> {
  const preset = MODEL_PRESETS.find((item) => item.id === presetId);
  return preset ? { ...preset.updates } : {};
}

/**
 * 检测当前是否处于「所有任务都沿用主模型」。
 *
 * 与旧实现的全等匹配不同，这里判断的是实质状态：只要还有角色指定了模型就不算统一，
 * 因此用户换过端点或模型名后依然能正确显示当前状态。
 */
export function detectModelPreset(form: AppSettings): ModelPresetId | null {
  return isFullyUnified(form) ? "inherit-main" : null;
}