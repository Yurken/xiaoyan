import { describe, expect, it } from "vitest";
import type { AppSettings } from "@research-copilot/types";
import { DEFAULT_SETTINGS } from "../../../features/settings/pageConfig";
import {
  ADVANCED_ROLE_CARDS,
  ALL_ROLE_MODEL_KEYS,
  CHARACTERISTIC_MODEL_CARDS,
  PRIMARY_ROLE_CARDS,
  countSpecializedRoles,
  getCardStatusSummary,
  isCardCustomized,
  isFullyUnified,
} from "../../../features/settings/roleRegistry";
import { applyModelPreset, detectModelPreset } from "../../../features/settings/modelPresets";

const form = (overrides: Partial<Record<keyof AppSettings, string>> = {}): AppSettings =>
  ({ ...DEFAULT_SETTINGS, ...overrides }) as AppSettings;

const cardById = (id: string) => {
  const card = CHARACTERISTIC_MODEL_CARDS.find((item) => item.id === id);
  if (!card) throw new Error(`缺少角色卡片: ${id}`);
  return card;
};

describe("角色模型注册表", () => {
  it("只有视觉与向量化是需要用户决定的硬能力边界", () => {
    expect(PRIMARY_ROLE_CARDS.map((card) => card.id).sort()).toEqual(["embedding", "vision"]);
    expect(PRIMARY_ROLE_CARDS.length + ADVANCED_ROLE_CARDS.length).toBe(
      CHARACTERISTIC_MODEL_CARDS.length,
    );
  });

  it("角色键都存在于默认设置中，且同一角色键不会被两张卡片重复声明", () => {
    const seen = new Set<string>();
    for (const card of CHARACTERISTIC_MODEL_CARDS) {
      const keys = [
        ...card.modelKeys,
        ...card.temperatureKeys,
        ...card.baseUrlKeys,
        ...card.apiKeyKeys,
      ];
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(DEFAULT_SETTINGS).toHaveProperty(key as string);
      }
      // 每个调用点只能归属一个角色，否则批量读写会互相覆盖。
      for (const key of card.modelKeys) {
        expect(seen.has(key as string)).toBe(false);
        seen.add(key as string);
      }
    }
  });

  it("不出卡片的兜底角色也被纳入统一范围", () => {
    // multi_agent_worker_model 参与多智能体与回退链，但没有独立的用户任务入口。
    expect(ALL_ROLE_MODEL_KEYS).toContain("multi_agent_worker_model");
  });

  it("默认设置本身就处于全部沿用主模型的状态", () => {
    expect(isFullyUnified(DEFAULT_SETTINGS)).toBe(true);
    expect(countSpecializedRoles(DEFAULT_SETTINGS)).toBe(0);
    expect(detectModelPreset(DEFAULT_SETTINGS)).toBe("inherit-main");
  });
});

describe("一键对齐预设", () => {
  it("「全部沿用主模型」清空所有角色，包含不出卡片的兜底角色", () => {
    const before = form({
      multi_agent_worker_model: "legacy-model",
      paper_analysis_model: "reasoner",
      planner_hint_model: "fast",
    });
    expect(isFullyUnified(before)).toBe(false);
    expect(countSpecializedRoles(before)).toBe(3);

    const after = { ...before, ...applyModelPreset("inherit-main") } as AppSettings;

    expect(ALL_ROLE_MODEL_KEYS.every((key) => after[key] === "")).toBe(true);
    expect(after.multi_agent_worker_model).toBe("");
    expect(after.paper_analysis_model).toBe("");
    expect(isFullyUnified(after)).toBe(true);
    // 统一之后预设状态可以重新被识别，不再像旧实现那样一次改动就永久失配。
    expect(detectModelPreset(after)).toBe("inherit-main");
  });

  it("「全部沿用主模型」不写任何厂商模型名", () => {
    const values = Object.values(applyModelPreset("inherit-main"));
    expect(values.every((value) => value === "")).toBe(true);
  });

  it("「恢复推荐参数」只写采样参数，不碰模型", () => {
    const updates = applyModelPreset("recommended-params");
    const touchedKeys = Object.keys(updates);

    expect(touchedKeys.length).toBeGreaterThan(0);
    expect(touchedKeys).toContain("planner_hint_temperature");
    expect(touchedKeys).toContain("rag_top_k");
    expect(ALL_ROLE_MODEL_KEYS.some((key) => touchedKeys.includes(key as string))).toBe(false);

    const before = form({ planner_hint_model: "fast", planner_hint_temperature: "0.9" });
    const after = { ...before, ...updates } as AppSettings;
    expect(after.planner_hint_model).toBe("fast");
    expect(after.planner_hint_temperature).toBe(cardById("quick-reply").temperaturePlaceholder);
  });
});

describe("角色状态判定", () => {
  it("残留的独立端点不影响「已统一」，卡片显示沿用主模型", () => {
    // 这是修复前的静默换模型场景：端点还在、模型被清空，旧逻辑会落到硬编码模型名。
    const stale = form({
      paper_analysis_base_url: "https://old.example.com/v1",
      paper_analysis_api_key: "sk-old",
    });

    expect(isFullyUnified(stale)).toBe(true);
    expect(isCardCustomized(stale, cardById("analysis"))).toBe(false);
    expect(getCardStatusSummary(stale, cardById("analysis"))).toBe("沿用主模型");
  });

  it("指定了模型才算自定义，并计入提示数量", () => {
    const mixed = form({ planner_hint_model: "fast", vision_model: "gpt-4o" });

    expect(isFullyUnified(mixed)).toBe(false);
    expect(countSpecializedRoles(mixed)).toBe(2);
    expect(detectModelPreset(mixed)).toBeNull();
    expect(isCardCustomized(mixed, cardById("quick-reply"))).toBe(true);
    expect(getCardStatusSummary(mixed, cardById("vision"))).toBe("gpt-4o");
  });
});