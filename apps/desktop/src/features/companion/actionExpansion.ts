import {
  COMPANION_ACTION_KEYS,
  type CompanionActionKey,
  type CompanionActionExpansionCandidate,
  type CompanionDefinition,
} from "./shared";

export interface SpriteActionAtlasRowPlan {
  actionKey: CompanionActionKey;
  row: number;
  frames: number;
  promptIntent: string;
}

export interface SpriteActionAtlasPack {
  id: string;
  label: string;
  image: string;
  rows: readonly SpriteActionAtlasRowPlan[];
}

export const SPRITE_COMPANION_ACTION_ATLAS_PACKS = [
  {
    id: "core",
    label: "核心陪伴",
    image: "/pets/xiaoyan/spritesheet.webp",
    rows: [
      { actionKey: "idle", row: 0, frames: 6, promptIntent: "安静待命、轻微呼吸和眨眼。" },
      { actionKey: "arriving", row: 1, frames: 8, promptIntent: "赶来加入任务，带一点向右移动感。" },
      { actionKey: "carrying", row: 2, frames: 8, promptIntent: "整理或搬运研究素材，带一点向左移动感。" },
      { actionKey: "attention", row: 3, frames: 4, promptIntent: "完成一步后的轻快提醒。" },
      { actionKey: "celebrating", row: 4, frames: 5, promptIntent: "任务成功后的开心庆祝。" },
      { actionKey: "error", row: 5, frames: 8, promptIntent: "异常后的可读复盘情绪。" },
      { actionKey: "looking", row: 6, frames: 6, promptIntent: "观察当前进展，动作低干扰。" },
      { actionKey: "working", row: 7, frames: 6, promptIntent: "普通工作中，非方向性忙碌循环。" },
      { actionKey: "thinking", row: 8, frames: 6, promptIntent: "认真看上下文、轻微思考。" },
    ],
  },
  {
    id: "research",
    label: "科研动作",
    image: "/pets/xiaoyan/spritesheet-research.webp",
    rows: [
      { actionKey: "planning", row: 0, frames: 6, promptIntent: "搭建任务路线，抬头思考但不加入新道具。" },
      { actionKey: "searching", row: 1, frames: 8, promptIntent: "检索线索和筛资料，避免速度线或浮动图标。" },
      { actionKey: "sweeping", row: 2, frames: 8, promptIntent: "清理和筛选文献线索，动作比 searching 更像整理。" },
      { actionKey: "writing", row: 3, frames: 4, promptIntent: "整理成文或写笔记，动作短促清晰。" },
      { actionKey: "summarizing", row: 4, frames: 5, promptIntent: "收束材料、点头确认或轻合掌。" },
      { actionKey: "debugger", row: 5, frames: 8, promptIntent: "盯日志、皱眉分析异常，不画 UI 或代码。" },
      { actionKey: "reading", row: 6, frames: 6, promptIntent: "低头阅读材料或轻微翻页。" },
      { actionKey: "building", row: 7, frames: 6, promptIntent: "搭建计划骨架或复现步骤骨架。" },
      { actionKey: "wizard", row: 8, frames: 6, promptIntent: "推进复现实现，保持小妍原本服装和花饰。" },
    ],
  },
  {
    id: "coordination",
    label: "调度反馈",
    image: "/pets/xiaoyan/spritesheet-coordination.webp",
    rows: [
      { actionKey: "ultrathink", row: 0, frames: 6, promptIntent: "深度综合，安静、专注、比 thinking 更沉稳。" },
      { actionKey: "juggling", row: 1, frames: 8, promptIntent: "并行处理多个步骤，通过姿态节奏表达，不加浮动道具。" },
      { actionKey: "conducting", row: 2, frames: 8, promptIntent: "协调多个小妍步骤，像打拍子一样同步任务节奏。" },
      { actionKey: "notification", row: 3, frames: 4, promptIntent: "有新动态，轻快提醒但无浮动铃铛或文字。" },
      { actionKey: "react_double", row: 4, frames: 5, promptIntent: "双击后的开心回应。" },
      { actionKey: "alerting", row: 5, frames: 8, promptIntent: "需要注意时的严肃提醒，比 error 更轻。" },
      { actionKey: "peeking", row: 6, frames: 6, promptIntent: "探头看操作，低幅度好读。" },
      { actionKey: "react_drag", row: 7, frames: 6, promptIntent: "拖拽换位置时跟随移动，非奔跑。" },
      { actionKey: "react_annoyed", row: 8, frames: 6, promptIntent: "连续打扰时的轻微无奈提醒。" },
    ],
  },
  {
    id: "rest-interaction",
    label: "休息互动",
    image: "/pets/xiaoyan/spritesheet-rest-interaction.webp",
    rows: [
      { actionKey: "resting", row: 0, frames: 6, promptIntent: "准备短暂休息，还没有睡着。" },
      { actionKey: "yawning", row: 1, frames: 8, promptIntent: "打哈欠，动作温和，不夸张变形。" },
      { actionKey: "dozing", row: 2, frames: 8, promptIntent: "犯困、轻微点头，保持站姿或坐姿稳定。" },
      { actionKey: "waking", row: 3, frames: 4, promptIntent: "醒来继续陪伴，动作短而清楚。" },
      { actionKey: "react_jump", row: 4, frames: 5, promptIntent: "点击后的轻快小跳，不画阴影或落地特效。" },
      { actionKey: "collapsing", row: 5, frames: 8, promptIntent: "逐步进入深度休息前的软倒动作。" },
      { actionKey: "sleeping", row: 6, frames: 6, promptIntent: "稳定休息态，低干扰循环。" },
      { actionKey: "react_left", row: 7, frames: 6, promptIntent: "点击左侧后的左向回应。" },
      { actionKey: "react_right", row: 8, frames: 6, promptIntent: "点击右侧后的右向回应。" },
    ],
  },
] as const satisfies readonly SpriteActionAtlasPack[];

export const SPRITE_COMPANION_ACTION_EXPANSIONS = [
  {
    actionKey: "reading",
    label: "读论文",
    group: "科研动作",
    currentAnimationKey: "review",
    targetAnimationKey: "reading",
    priority: "high",
    intent: "低头阅读、轻微翻页或视线移动，和普通 review 区分开。",
  },
  {
    actionKey: "writing",
    label: "写笔记",
    group: "科研动作",
    currentAnimationKey: "review",
    targetAnimationKey: "writing",
    priority: "high",
    intent: "双手整理笔记或输入文字，表达正在产出内容。",
  },
  {
    actionKey: "summarizing",
    label: "综合结论",
    group: "科研动作",
    currentAnimationKey: "review",
    targetAnimationKey: "summarizing",
    priority: "high",
    intent: "把材料收束成结论，可用点头、合掌或笔记本收拢动作。",
  },
  {
    actionKey: "planning",
    label: "规划路线",
    group: "任务编排",
    currentAnimationKey: "review",
    targetAnimationKey: "planning",
    priority: "high",
    intent: "抬头思考路线，和阅读态区分，适合 chat:plan 和规划步骤。",
  },
  {
    actionKey: "searching",
    label: "检索线索",
    group: "任务编排",
    currentAnimationKey: "runningRight",
    targetAnimationKey: "searching",
    priority: "high",
    intent: "筛线索或扫资料，不再借用右跑步。",
  },
  {
    actionKey: "debugger",
    label: "分析异常",
    group: "错误复盘",
    currentAnimationKey: "review",
    targetAnimationKey: "debugger",
    priority: "high",
    intent: "盯住日志或皱眉分析，和 error / alerting 分出层级。",
  },
  {
    actionKey: "building",
    label: "搭建骨架",
    group: "任务编排",
    currentAnimationKey: "review",
    targetAnimationKey: "building",
    priority: "medium",
    intent: "把计划骨架搭起来，适合复现和生成类任务。",
  },
  {
    actionKey: "conducting",
    label: "协调调度",
    group: "多任务",
    currentAnimationKey: "review",
    targetAnimationKey: "conducting",
    priority: "medium",
    intent: "协调多个小妍步骤，适合三项以上并行工作。",
  },
  {
    actionKey: "ultrathink",
    label: "深度综合",
    group: "多任务",
    currentAnimationKey: "review",
    targetAnimationKey: "ultrathink",
    priority: "medium",
    intent: "进入更安静、更专注的深度思考态。",
  },
  {
    actionKey: "carrying",
    label: "搬运素材",
    group: "任务编排",
    currentAnimationKey: "runningLeft",
    targetAnimationKey: "carrying",
    priority: "medium",
    intent: "抱着材料移动，替代左跑步 fallback。",
  },
  {
    actionKey: "yawning",
    label: "打哈欠",
    group: "休息链路",
    currentAnimationKey: "idle",
    targetAnimationKey: "yawning",
    priority: "medium",
    intent: "为允许休息的形象补上 idle 到 sleeping 的过渡。",
  },
  {
    actionKey: "dozing",
    label: "犯困",
    group: "休息链路",
    currentAnimationKey: "idle",
    targetAnimationKey: "dozing",
    priority: "medium",
    intent: "轻微闭眼摇晃，承接 yawning。",
  },
  {
    actionKey: "sleeping",
    label: "休息",
    group: "休息链路",
    currentAnimationKey: "idle",
    targetAnimationKey: "sleeping",
    priority: "medium",
    intent: "稳定的低干扰休息态，为小妍本体开启休息预留资源。",
  },
  {
    actionKey: "react_left",
    label: "左侧回应",
    group: "互动反馈",
    currentAnimationKey: "waving",
    targetAnimationKey: "react_left",
    priority: "low",
    intent: "点击左侧时做更明确的左向回应。",
  },
  {
    actionKey: "react_right",
    label: "右侧回应",
    group: "互动反馈",
    currentAnimationKey: "waving",
    targetAnimationKey: "react_right",
    priority: "low",
    intent: "点击右侧时做更明确的右向回应。",
  },
  {
    actionKey: "react_annoyed",
    label: "轻提醒",
    group: "互动反馈",
    currentAnimationKey: "failed",
    targetAnimationKey: "react_annoyed",
    priority: "low",
    intent: "连续打扰或任务中点击时，给出轻微专注提醒。",
  },
] as const satisfies readonly CompanionActionExpansionCandidate[];

export interface CompanionMotionCoverage {
  semanticActionCount: number;
  animationCount: number;
  fallbackActionCount: number;
  candidates: readonly CompanionActionExpansionCandidate[];
  highPriorityCandidates: CompanionActionExpansionCandidate[];
}

export function getCompanionMotionCoverage(definition: CompanionDefinition): CompanionMotionCoverage {
  const idleAnimationKey = definition.actionMap.idle ?? "idle";
  const animationKeys = new Set(
    COMPANION_ACTION_KEYS.map((key) => definition.actionMap[key] ?? idleAnimationKey),
  );
  const candidates = definition.actionExpansionCandidates ?? [];

  return {
    semanticActionCount: COMPANION_ACTION_KEYS.length,
    animationCount: animationKeys.size,
    fallbackActionCount: Math.max(0, COMPANION_ACTION_KEYS.length - animationKeys.size),
    candidates,
    highPriorityCandidates: candidates.filter((item) => item.priority === "high"),
  };
}
