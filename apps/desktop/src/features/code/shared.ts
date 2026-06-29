import { Bot, BrainCircuit, Compass, Globe, Search } from "lucide-react";
import type { DirEntry } from "../../lib/client";
import type { LlmProvider } from "@research-copilot/types";

export type { DirEntry };

// ── Code File Attachments ─────────────────────────────────────
export interface CodeFileAttachment {
  id: string;
  path: string;
  name: string;
  content: string;
  truncated: boolean;
}

const MAX_ATTACH_FILE_CHARS = 15_000;

/** 读取文件内容，截断到上限。返回 null 表示读取失败。 */
export async function readAttachmentFile(filePath: string): Promise<Omit<CodeFileAttachment, "id"> | null> {
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const raw = await readTextFile(filePath);
    const truncated = raw.length > MAX_ATTACH_FILE_CHARS;
    const content = truncated ? raw.slice(0, MAX_ATTACH_FILE_CHARS) : raw;
    const name = filePath.split(/[/\\]/).pop() ?? filePath;
    return { path: filePath, name, content, truncated };
  } catch {
    return null;
  }
}

// ── Code Agent Modes ─────────────────────────────────────────
export type CodeAgentMode = "build" | "plan" | "general" | "explore" | "scout";

export interface CodeModeConfig {
  id: CodeAgentMode;
  label: string;
  description: string;
  icon: typeof Bot;
  /** 是否为主模式（显示在切换器左侧） */
  primary: boolean;
  /** 是否默认需要确认写操作 */
  confirmWrites: boolean;
  /** 是否只读（禁止写入/执行） */
  readOnly: boolean;
  /** 工具集过滤：null=全部，否则只包含列出的类别 */
  toolCategories: "all" | "readonly" | "research";
}

export const CODE_MODES: CodeModeConfig[] = [
  {
    id: "build",
    label: "Build",
    description: "编写代码、修改文件、运行命令、测试",
    icon: Bot,
    primary: true,
    confirmWrites: false,
    readOnly: false,
    toolCategories: "all",
  },
  {
    id: "plan",
    label: "Plan",
    description: "分析代码、制定方案、Code Review",
    icon: BrainCircuit,
    primary: true,
    confirmWrites: true,
    readOnly: false,
    toolCategories: "all",
  },
  {
    id: "general",
    label: "General",
    description: "通用任务，可并行处理复杂工作",
    icon: Globe,
    primary: false,
    confirmWrites: false,
    readOnly: false,
    toolCategories: "all",
  },
  {
    id: "explore",
    label: "Explore",
    description: "只读探索代码库、搜索、理解架构",
    icon: Compass,
    primary: false,
    confirmWrites: false,
    readOnly: true,
    toolCategories: "readonly",
  },
  {
    id: "scout",
    label: "Scout",
    description: "查询外部文档、依赖源码、上游仓库",
    icon: Search,
    primary: false,
    confirmWrites: false,
    readOnly: true,
    toolCategories: "research",
  },
];

export const CODE_MODE_MAP = Object.fromEntries(CODE_MODES.map((m) => [m.id, m])) as Record<CodeAgentMode, CodeModeConfig>;

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

export interface CodeModelOption {
  id: string;
  provider: LlmProvider;
  providerLabel: string;
  model: string;
  label: string;
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
