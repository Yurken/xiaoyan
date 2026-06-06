import {
  BookOpen,
  FileText,
  Library,
  MessageSquare,
  Microscope,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { InterestTab } from "../knowledge/ResearchWorkbench";

export type FreeTab =
  | "survey"
  | "papers"
  | "knowledge"
  | "xiaoyan"
  | "tools"
  | "experiment"
  | "submission";

export type LegacyFreeTab = FreeTab | "copilot";

export const FREE_TABS: Array<{ key: FreeTab; label: string; icon: typeof Sparkles }> = [
  { key: "survey", label: "综述", icon: BookOpen },
  { key: "papers", label: "论文", icon: FileText },
  { key: "knowledge", label: "知识", icon: Library },
  { key: "xiaoyan", label: "小妍", icon: MessageSquare },
  { key: "experiment", label: "实验", icon: Microscope },
  { key: "submission", label: "投稿", icon: Send },
  { key: "tools", label: "工具", icon: Wrench },
];

const FREE_TAB_KEYS = FREE_TABS.map((t) => t.key);
const FREE_TAB_SET = new Set<string>(FREE_TAB_KEYS);

export function isFreeTab(value?: string): value is FreeTab {
  return FREE_TAB_SET.has(value ?? "");
}

export function normalizeFreeTab(value?: string): FreeTab {
  if (value === "copilot") return "xiaoyan";
  return isFreeTab(value) ? value : "survey";
}

export const BASE_INTEREST_TABS: Array<{
  key: InterestTab;
  label: string;
  icon: typeof Sparkles;
}> = [
  { key: "overview", label: "总览", icon: Microscope },
  { key: "papers", label: "论文", icon: FileText },
  { key: "xiaoyan", label: "小妍", icon: MessageSquare },
  { key: "notes", label: "笔记", icon: Library },
  { key: "experiment", label: "实验", icon: Microscope },
  { key: "submission", label: "投稿", icon: Send },
  { key: "tools", label: "工具", icon: Wrench },
];

export const PLANNER_TAB: {
  key: InterestTab;
  label: string;
  icon: typeof Sparkles;
} = { key: "planner", label: "规划", icon: Sparkles };

export const INTEREST_TAB_KEYS: readonly InterestTab[] = [
  "overview",
  "planner",
  "papers",
  "xiaoyan",
  "notes",
  "tools",
  "experiment",
  "submission",
];

const INTEREST_TAB_SET = new Set<string>(INTEREST_TAB_KEYS);

export function isInterestTab(value?: string): value is InterestTab {
  return INTEREST_TAB_SET.has(value ?? "");
}

export function normalizeInterestTab(
  value: string | undefined,
  planned: boolean,
): InterestTab {
  if (isInterestTab(value) && (value !== "planner" || planned)) {
    return value;
  }
  return "overview";
}
