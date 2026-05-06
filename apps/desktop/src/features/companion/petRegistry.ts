import type { CompanionActionKey, CompanionDefinition, CompanionId, SpriteAnimation } from "./shared";
import { DEFAULT_COMPANION_ID, normalizeCompanionId } from "./shared";

const xiaoyanAnimations = {
  idle: { row: 0, frames: 6, fps: 10, playMode: "blink", sequence: [0, 1, 2, 1, 0], intervalMinMs: 3000, intervalMaxMs: 10000 },
  runningRight: { row: 1, frames: 8, fps: 10 },
  runningLeft: { row: 2, frames: 8, fps: 10 },
  waving: { row: 3, frames: 4, fps: 5 },
  jumping: { row: 4, frames: 5, fps: 7 },
  failed: { row: 5, frames: 8, fps: 5 },
  waiting: { row: 6, frames: 6, fps: 4 },
  running: { row: 7, frames: 6, fps: 8 },
  review: { row: 8, frames: 6, fps: 4 },
} satisfies Record<string, SpriteAnimation>;

const xiaoyanActionMap: Record<CompanionActionKey, keyof typeof xiaoyanAnimations> = {
  idle: "idle",
  yawning: "idle",
  dozing: "idle",
  collapsing: "idle",
  sleeping: "idle",
  waking: "waving",
  thinking: "review",
  working: "running",
  building: "review",
  sweeping: "runningRight",
  carrying: "runningLeft",
  debugger: "review",
  wizard: "jumping",
  ultrathink: "review",
  juggling: "running",
  conducting: "review",
  attention: "waving",
  error: "failed",
  notification: "waving",
  react_left: "waving",
  react_right: "waving",
  react_annoyed: "failed",
  react_double: "jumping",
  react_jump: "jumping",
  react_drag: "running",
};

const dundunSvg = {
  idle: "/dundun/clawd-idle-follow.svg",
  yawning: "/dundun/clawd-idle-yawn.svg",
  dozing: "/dundun/clawd-idle-doze.svg",
  collapsing: "/dundun/clawd-collapse-sleep.svg",
  sleeping: "/dundun/clawd-sleeping.svg",
  waking: "/dundun/clawd-wake.svg",
  thinking: "/dundun/clawd-working-thinking.svg",
  working: "/dundun/clawd-working-typing.svg",
  building: "/dundun/clawd-working-building.svg",
  sweeping: "/dundun/clawd-working-sweeping.svg",
  carrying: "/dundun/clawd-working-carrying.svg",
  debugger: "/dundun/clawd-working-debugger.svg",
  wizard: "/dundun/clawd-working-wizard.svg",
  ultrathink: "/dundun/clawd-working-ultrathink.svg",
  juggling: "/dundun/clawd-working-juggling.svg",
  conducting: "/dundun/clawd-working-conducting.svg",
  attention: "/dundun/clawd-happy.svg",
  error: "/dundun/clawd-error.svg",
  notification: "/dundun/clawd-notification.svg",
  react_left: "/dundun/clawd-react-left.svg",
  react_right: "/dundun/clawd-react-right.svg",
  react_annoyed: "/dundun/clawd-react-annoyed.svg",
  react_double: "/dundun/clawd-react-double.svg",
  react_jump: "/dundun/clawd-react-double-jump.svg",
  react_drag: "/dundun/clawd-react-drag.svg",
} satisfies Record<CompanionActionKey, string>;

const xiaoyanTooltips: Partial<Record<CompanionActionKey, string>> = {
  idle: "小妍在旁边待命，随时准备接住你的研究问题。",
  thinking: "小妍正在认真看上下文。",
  working: "小妍正在推进任务。",
  building: "小妍在搭建计划骨架。",
  sweeping: "小妍在检索和筛选材料。",
  carrying: "小妍在整理研究素材。",
  debugger: "小妍正在分析问题。",
  wizard: "小妍在推进复现实现。",
  ultrathink: "小妍进入深度综合状态。",
  juggling: "小妍正在并行处理多个步骤。",
  conducting: "小妍在协调多个能力域模型。",
  attention: "小妍完成了一步。",
  error: "小妍遇到异常，正在等你一起复盘。",
  notification: "小妍有新的研究动态。",
  react_left: "小妍挥手回应。",
  react_right: "小妍挥手回应。",
  react_annoyed: "小妍提醒你先专注当前任务。",
  react_double: "小妍开心地跳了一下。",
  react_jump: "小妍开心地跳了一下。",
  react_drag: "小妍正在跟着你换驻点。",
};

const dundunTooltips: Partial<Record<CompanionActionKey, string>> = {
  idle: "墩墩在旁边待命。",
  yawning: "墩墩打了个哈欠。",
  dozing: "墩墩短暂休息中。",
  collapsing: "墩墩准备进入深度休息。",
  sleeping: "墩墩休息中。",
  waking: "墩墩醒来了。",
  thinking: "墩墩正在学着思考。",
  working: "墩墩跟着敲空气键盘。",
  building: "墩墩抱着小图纸模仿规划。",
  sweeping: "墩墩拿小扫帚整理文献库。",
  carrying: "墩墩抱着迷你文件夹跟着跑。",
  debugger: "墩墩认真盯着日志。",
  wizard: "墩墩披上小斗篷模仿复现。",
  ultrathink: "墩墩切换超认真模式。",
  juggling: "墩墩努力跟上双线程节奏。",
  conducting: "墩墩挥爪同步打拍子。",
  attention: "墩墩先替她报喜。",
  error: "墩墩皱眉陪你复盘。",
  notification: "墩墩带来了新提醒。",
  react_left: "墩墩点头回应。",
  react_right: "墩墩露出开心表情。",
  react_annoyed: "墩墩提醒你先让小妍专注。",
  react_double: "墩墩进入兴奋互动状态。",
  react_jump: "墩墩轻快起跳。",
  react_drag: "墩墩换了驻点。",
};

const staticImageActionMap = Object.fromEntries(
  Object.keys(dundunSvg).map((key) => [key, "idle"]),
) as Record<CompanionActionKey, string>;

const whiteDumplingTooltips: Partial<Record<CompanionActionKey, string>> = {
  idle: "白团子抱着研究笔记，安静陪你待命。",
  yawning: "白团子有点困，但还抱着笔记本。",
  dozing: "白团子短暂打盹中。",
  collapsing: "白团子准备把笔记本放下休息。",
  sleeping: "白团子进入软乎乎的休息时间。",
  waking: "白团子醒来继续陪你。",
  thinking: "白团子正在认真看你的研究线索。",
  working: "白团子抱紧笔记本，跟你一起推进任务。",
  building: "白团子在脑内搭建小计划。",
  sweeping: "白团子正在帮你筛资料。",
  carrying: "白团子把研究素材收进笔记本。",
  debugger: "白团子盯住异常线索。",
  wizard: "白团子准备复现实验步骤。",
  ultrathink: "白团子进入超认真研究模式。",
  juggling: "白团子努力跟上多个任务。",
  conducting: "白团子在旁边同步任务节奏。",
  attention: "白团子提醒你有新进展。",
  error: "白团子抱着笔记陪你复盘异常。",
  notification: "白团子带来了新提醒。",
  react_left: "白团子回应了你。",
  react_right: "白团子开心回应。",
  react_annoyed: "白团子提醒你先聚焦当前任务。",
  react_double: "白团子开心地抖了一下。",
  react_jump: "白团子准备轻快起跳。",
  react_drag: "白团子换了一个陪伴位置。",
};

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
    label: "白团子",
    description: "新增的白色圆团宠物形象，抱着研究笔记本，当前以静态透明图接入。",
    allowIdleSleep: true,
    renderer: {
      kind: "static-image",
      image: "/pets/white-dumpling/base.png",
      alt: "白团子",
    },
    actionMap: staticImageActionMap,
    tooltips: whiteDumplingTooltips,
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
