import type { KnowledgeNote } from "@research-copilot/types";

export type NotesScope = "all" | "unfiled" | `interest:${string}`;

export interface NoteDraft {
  title: string;
  content: string;
  research_interest_id: string;
}

export type NoteSaveState = "clean" | "draft" | "saving" | "saved" | "error";

export function compareNotesByUpdatedAt(left: KnowledgeNote, right: KnowledgeNote): number {
  return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
}

export function deriveNoteTitle(content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s+/, "").trim())
    .find(Boolean);
  return firstLine?.slice(0, 60) || "无标题笔记";
}

export function formatNoteUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return `更新于 ${date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}
