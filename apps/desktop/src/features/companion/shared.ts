export const DEFAULT_COMPANION_ID = "xiaoyan";
export const COMPANION_PREFERENCE_EVENT = "rc:companion-preference-change";
export const COMPANION_PREFERENCE_STORAGE_KEY = "rc:companion:id";

export type CompanionId = "xiaoyan" | "xiaoyan-pet";

export type CompanionActionKey =
  | "idle"
  | "yawning"
  | "dozing"
  | "collapsing"
  | "sleeping"
  | "waking"
  | "thinking"
  | "working"
  | "building"
  | "sweeping"
  | "carrying"
  | "debugger"
  | "wizard"
  | "ultrathink"
  | "juggling"
  | "conducting"
  | "attention"
  | "error"
  | "notification"
  | "react_left"
  | "react_right"
  | "react_annoyed"
  | "react_double"
  | "react_jump"
  | "react_drag";

export type CompanionRendererKind = "sprite-atlas" | "svg-set";

export interface SpriteAnimation {
  row: number;
  frames: number;
  fps: number;
  playMode?: "loop" | "blink";
  sequence?: number[];
  intervalMs?: number;
  intervalMinMs?: number;
  intervalMaxMs?: number;
}

export interface SpriteAtlasDefinition {
  kind: "sprite-atlas";
  image: string;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  animations: Record<string, SpriteAnimation>;
}

export interface SvgSetDefinition {
  kind: "svg-set";
  assets: Record<string, string>;
}

export interface CompanionDefinition {
  id: CompanionId;
  label: string;
  description: string;
  renderer: SpriteAtlasDefinition | SvgSetDefinition;
  actionMap: Partial<Record<CompanionActionKey, string>>;
  tooltips: Partial<Record<CompanionActionKey, string>>;
}

export interface WorkItem {
  actionKey: CompanionActionKey;
  priority: number;
}

export const WORK_PRIORITY: Record<CompanionActionKey, number> = {
  idle: 1,
  yawning: 1,
  dozing: 1,
  collapsing: 1,
  sleeping: 1,
  waking: 2,
  thinking: 2,
  working: 3,
  building: 4,
  sweeping: 3,
  carrying: 3,
  debugger: 5,
  wizard: 7,
  ultrathink: 6,
  juggling: 3,
  conducting: 5,
  attention: 3,
  error: 5,
  notification: 3,
  react_left: 3,
  react_right: 3,
  react_annoyed: 3,
  react_double: 4,
  react_jump: 4,
  react_drag: 3,
};

export function isCompanionId(value: string): value is CompanionId {
  return value === "xiaoyan" || value === "xiaoyan-pet";
}

export function normalizeCompanionId(value: string | null | undefined): CompanionId {
  return value && isCompanionId(value) ? value : DEFAULT_COMPANION_ID;
}

export function emitCompanionPreferenceChange(id: CompanionId) {
  window.localStorage.setItem(COMPANION_PREFERENCE_STORAGE_KEY, id);
  window.dispatchEvent(
    new CustomEvent<{ id: CompanionId }>(COMPANION_PREFERENCE_EVENT, {
      detail: { id },
    }),
  );
}

export function chatAgentAction(agentName: string): CompanionActionKey {
  const map: Record<string, CompanionActionKey> = {
    retrieval: "sweeping",
    planner: "building",
    literature_scout: "carrying",
    survey: "working",
    paper_analyst: "debugger",
    reproduction: "wizard",
    synthesis: "ultrathink",
  };
  return map[agentName] ?? "thinking";
}

export function surveyAgentAction(name: string): CompanionActionKey {
  if (name.includes("检索规划")) return "building";
  if (name.includes("文献检索")) return "sweeping";
  if (name.includes("时序分析")) return "debugger";
  if (name.includes("综述写作")) return "working";
  return "thinking";
}

export function interestAgentAction(name: string): CompanionActionKey {
  if (name.includes("规划") || name.includes("路径")) return "building";
  if (name.includes("筛选") || name.includes("文献")) return "carrying";
  return "thinking";
}

export function resolveWorkAction(items: Map<string, WorkItem>): CompanionActionKey | null {
  if (items.size === 0) return null;
  if (items.size >= 3) return "conducting";
  if (items.size === 2) return "juggling";

  let best: WorkItem | null = null;
  for (const item of items.values()) {
    if (!best || item.priority > best.priority) {
      best = item;
    }
  }
  return best?.actionKey ?? "thinking";
}
