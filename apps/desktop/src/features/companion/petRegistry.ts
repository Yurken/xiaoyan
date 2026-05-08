import { SPRITE_COMPANION_ACTION_EXPANSIONS } from "./actionExpansion";
import {
  compactSpriteActionMap,
  compactSpriteAnimations,
  dundunSvg,
  xiaoyanActionMap,
  xiaoyanActionSheets,
  xiaoyanAnimations,
} from "./companionAssets";
import { dundunTooltips, whiteDumplingTooltips, xiaoyanTooltips } from "./companionTooltips";
import type { CompanionActionKey, CompanionDefinition, CompanionId } from "./shared";
import { DEFAULT_COMPANION_ID, normalizeCompanionId } from "./shared";

export const COMPANION_DEFINITIONS: Record<CompanionId, CompanionDefinition> = {
  xiaoyan: {
    id: "xiaoyan",
    label: "小妍",
    description: "以小妍本体作为桌面伴侣，使用全身像 spritesheet 动作。",
    allowIdleSleep: false,
    renderer: {
      kind: "sprite-atlas",
      image: "/pets/xiaoyan/spritesheet.webp",
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 9,
      sheets: xiaoyanActionSheets,
      animations: xiaoyanAnimations,
    },
    actionMap: xiaoyanActionMap,
    tooltips: xiaoyanTooltips,
  },
  "xiaoyan-pet": {
    id: "xiaoyan-pet",
    label: "墩墩",
    description: "保留原墩墩 SVG 动作资产，作为小妍的宠物形象。",
    allowIdleSleep: true,
    renderer: {
      kind: "svg-set",
      assets: dundunSvg,
    },
    actionMap: Object.fromEntries(
      Object.keys(dundunSvg).map((key) => [key, key]),
    ) as Record<CompanionActionKey, CompanionActionKey>,
    tooltips: dundunTooltips,
  },
  "white-dumpling": {
    id: "white-dumpling",
    label: "团子",
    description: "新增的白色圆团宠物形象，抱着研究笔记本，使用完整 spritesheet 动作。",
    allowIdleSleep: true,
    renderer: {
      kind: "sprite-atlas",
      image: "/pets/white-dumpling/spritesheet.webp",
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 9,
      animations: compactSpriteAnimations,
    },
    actionMap: compactSpriteActionMap,
    tooltips: whiteDumplingTooltips,
    actionExpansionCandidates: SPRITE_COMPANION_ACTION_EXPANSIONS,
  },
};

export const COMPANION_OPTIONS = Object.values(COMPANION_DEFINITIONS).map((item) => ({
  id: item.id,
  label: item.label,
  description: item.description,
}));

export function getCompanionDefinition(id: string | null | undefined) {
  return COMPANION_DEFINITIONS[normalizeCompanionId(id)];
}

export function getCompanionAnimationKey(
  definition: CompanionDefinition,
  actionKey: CompanionActionKey,
): string {
  return definition.actionMap[actionKey] ?? definition.actionMap.idle ?? "idle";
}

export function getCompanionTooltip(
  definition: CompanionDefinition,
  actionKey: CompanionActionKey,
): string {
  return definition.tooltips[actionKey] ?? definition.tooltips.idle ?? `${definition.label}正在陪你观察研究进展。`;
}

export const DEFAULT_COMPANION = COMPANION_DEFINITIONS[DEFAULT_COMPANION_ID];
