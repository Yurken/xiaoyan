import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { interestFolderName } from "../../lib/interestUtils";

export type NotesViewMode = "card" | "list" | "minimal";

/** 将 Markdown 文本压成单行纯文本，用于卡片摘要展示。 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`{1,3}([^`\n]*)`{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

/** 知识卡片来源类型的中文标签。 */
export function sourceLabel(sourceType: string): string {
  if (sourceType === "manual") return "手动";
  if (sourceType === "paper_analysis") return "论文分析";
  if (sourceType === "paper_note") return "论文笔记";
  if (sourceType === "web_clip") return "网页剪藏";
  if (sourceType === "import") return "文件导入";
  if (sourceType === "chat") return "对话";
  if (sourceType === "survey") return "综述";
  return sourceType || "未知来源";
}

/**
 * 构造「关联研究主题」下拉选项，首项为空值占位。
 * @param emptyLabel 空值项文案（如「不关联」「未归档」）。
 */
export function buildInterestOptions(
  interests: ResearchInterest[],
  emptyLabel: string,
): Array<{ value: string; label: string }> {
  return [
    { value: "", label: emptyLabel },
    ...interests.map((item) => ({ value: item.id, label: interestFolderName(item) })),
  ];
}

/** 从本地文件路径与原始文本解析出可导入的笔记标题与正文。 */
export function parseNoteFromFile(filePath: string, raw: string): { fileName: string; title: string; content: string } {
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
  const baseName = fileName.replace(/\.(md|txt|markdown)$/i, "").trim();
  let content = raw.replace(/\r\n/g, "\n").trim();
  let title = baseName;

  if (/\.md$/i.test(fileName) || /\.markdown$/i.test(fileName)) {
    const firstLine = content.split("\n")[0]?.trim() ?? "";
    if (firstLine.startsWith("# ")) {
      title = firstLine.slice(2).trim();
      content = content.slice(firstLine.length).trim();
    }
  }

  return { fileName, title: title || baseName || "导入笔记", content };
}

/** 把文本清洗成安全的文件名（去掉路径分隔符等非法字符）。 */
export function sanitizeNoteFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\n\r]+/g, " ").trim().slice(0, 60);
  return cleaned || "知识卡片";
}

function formatNoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * 将多条知识卡片合并为单个 Markdown 文档：每条带标题、元信息（来源 / 主题 / 标签 / 时间）与正文，用分隔线隔开。
 */
export function buildNotesMarkdown(
  notes: KnowledgeNote[],
  interestMap: Record<string, ResearchInterest> = {},
): string {
  const sections = notes.map((note) => {
    const meta = [`来源：${sourceLabel(note.source_type)}`];
    const interest = note.research_interest_id ? interestMap[note.research_interest_id] : undefined;
    if (interest) meta.push(`研究主题：${interestFolderName(interest)}`);
    if (note.tags && note.tags.length > 0) meta.push(`标签：${note.tags.join("、")}`);
    meta.push(`创建于 ${formatNoteDate(note.created_at)}`);

    const body = note.content.trim() || "（无内容）";
    return `# ${note.title}\n\n> ${meta.join(" · ")}\n\n${body}`;
  });

  return `${sections.join("\n\n---\n\n")}\n`;
}
