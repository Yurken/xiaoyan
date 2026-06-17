import type { DirEntry } from "../../lib/client";

export type { DirEntry };

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
}

export interface FileNode {
  entry: DirEntry;
  expanded: boolean;
  children: FileNode[];
}

/** 一个代码工具的前端展示定义。与后端 `code::tools::TOOLS` 的顺序、id 保持一致。 */
export interface CodeToolDef {
  id: string;
  label: string;
  /**
   * 常用模型预设，作为输入框的 datalist 建议。留空数组表示无内置建议；
   * 任何工具都允许用户自由输入模型名，空值表示使用工具自带默认模型。
   */
  models: string[];
  /** 模型输入框占位提示。 */
  modelHint: string;
}

/**
 * 已知代码工具清单。模型预设仅为常见值的便捷建议，并非详尽列表——
 * 实际可用模型以各工具本地配置为准，用户可手动输入任意模型名。
 */
export const CODE_TOOLS: CodeToolDef[] = [
  { id: "claude", label: "Claude Code", models: ["sonnet", "opus", "haiku"], modelHint: "留空用默认 · 可填 sonnet/opus…" },
  { id: "codex", label: "Codex", models: [], modelHint: "留空用默认 · 可填模型名" },
  { id: "gemini", label: "Gemini CLI", models: ["gemini-2.5-pro", "gemini-2.5-flash"], modelHint: "留空用默认 · 可填 gemini-…" },
  { id: "opencode", label: "opencode", models: [], modelHint: "留空用默认 · 格式 provider/model" },
  { id: "kimi", label: "Kimi CLI", models: [], modelHint: "留空用默认 · 可填模型名" },
];

export const CODE_TOOL_LABELS: Record<string, string> = Object.fromEntries(
  CODE_TOOLS.map((t) => [t.id, t.label]),
);

export function codeToolLabel(id: string | null | undefined): string {
  if (!id) return "";
  return CODE_TOOL_LABELS[id] ?? id;
}
