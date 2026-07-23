import {
  AlertTriangle,
  CheckCircle2,
  FilePenLine,
  FileText,
  FolderTree,
  Layers,
  Loader2,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";
import type { CodeToolCall, CodeToolResult } from "../../lib/client";

interface CodeToolCallCardProps {
  toolCall: CodeToolCall;
}

interface CodeToolResultCardProps {
  result: CodeToolResult;
}

/**
 * 极简单行标注：用于聊天正文里展示一次工具调用。
 * 形式参考小妍陪聊模块的思考过程：
 *   ◎ 查看文件、定位代码: prompt.rs
 *   ◎ 搜索代码: TODO   ✓
 *   ⚠ grep: ...   ×
 *
 * 与 `CodeToolCallCard`（权限面板里需要看完整参数）的区别：
 * - 不展开、无 JSON 参数、无完整输出；
 * - 单行显示：图标 + 动词式动作描述 + 目标/路径 + 状态点。
 */
interface CodeToolActionLineProps {
  toolCall: CodeToolCall;
  result?: CodeToolResult;
  /** 工具调用已发出但结果还没回来时显示 loader；不传则根据 result 推断。 */
  pending?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  read_file: "读取文件",
  list_dir: "列出目录",
  glob_files: "匹配文件",
  search_files: "搜索代码",
  workspace_context: "工作区上下文",
  write_file: "写入文件",
  edit_file: "编辑文件",
  run_command: "执行命令",
  fetch_url: "读取网页",
};

const TOOL_VERBS: Record<string, string> = {
  read_file: "查看文件",
  list_dir: "列出目录",
  glob_files: "匹配文件",
  search_files: "搜索代码",
  workspace_context: "加载工作区上下文",
  write_file: "写入文件",
  edit_file: "编辑文件",
  run_command: "执行命令",
  fetch_url: "读取网页",
};

const AUTO_COLLAPSED_TOOLS = new Set([
  "read_file",
  "list_dir",
  "glob_files",
  "search_files",
  "workspace_context",
]);

function ToolIcon({ name }: { name: string }) {
  if (name === "read_file") return <FileText size={12} />;
  if (name === "list_dir") return <FolderTree size={12} />;
  if (name === "glob_files") return <FolderTree size={12} />;
  if (name === "search_files") return <Search size={12} />;
  if (name === "workspace_context") return <Layers size={12} />;
  if (name === "write_file" || name === "edit_file") return <FilePenLine size={12} />;
  if (name === "run_command") return <Terminal size={12} />;
  return <Wrench size={12} />;
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

function toolVerb(name: string): string {
  return TOOL_VERBS[name] ?? toolLabel(name);
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function formatArguments(raw: string): string {
  const parsed = parseArguments(raw);
  if (typeof parsed === "string") return parsed;
  return JSON.stringify(parsed, null, 2);
}

function argumentSummary(raw: string): string {
  const parsed = parseArguments(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";

  const args = parsed as Record<string, unknown>;
  // 优先挑出"目标"：文件路径、glob pattern、shell 命令、URL…
  const preferred =
    args.file_path ?? args.path ?? args.pattern ?? args.command ?? args.url ?? args.query;
  if (typeof preferred !== "string") return "";
  // 太长的 command / 输出截断展示
  return preferred.length > 80 ? `${preferred.slice(0, 77)}…` : preferred;
}

export function CodeToolCallCard({ toolCall }: CodeToolCallCardProps) {
  const summary = argumentSummary(toolCall.arguments);
  const defaultOpen = !AUTO_COLLAPSED_TOOLS.has(toolCall.name);

  return (
    <details className="code-tool-card code-tool-card--call" open={defaultOpen}>
      <summary className="code-tool-card__summary">
        <span className="code-tool-card__summary-left">
          <ToolIcon name={toolCall.name} />
          <span>{toolLabel(toolCall.name)}</span>
        </span>
        {summary && <span className="code-tool-card__summary-path">{summary}</span>}
      </summary>
      <pre className="code-tool-card__body">
        <code>{formatArguments(toolCall.arguments)}</code>
      </pre>
    </details>
  );
}

export function CodeToolResultCard({ result }: CodeToolResultCardProps) {
  return (
    <details
      className={`code-tool-card code-tool-card--result ${result.is_error ? "is-error" : "is-ok"}`}
      open={result.is_error}
    >
      <summary className="code-tool-card__summary">
        <span className="code-tool-card__summary-left">
          {result.is_error ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          <span>{toolLabel(result.name)}</span>
        </span>
        <span className="code-tool-card__status">{result.is_error ? "失败" : "完成"}</span>
      </summary>
      <pre className="code-tool-card__body">
        <code>{result.output}</code>
      </pre>
    </details>
  );
}

/** 极简单行工具调用标注。 */
export function CodeToolActionLine({
  toolCall,
  result,
  pending,
}: CodeToolActionLineProps) {
  const target = argumentSummary(toolCall.arguments);
  const verb = toolVerb(toolCall.name);
  const isError = result?.is_error === true;

  // 状态：pending（执行中）/ ok（成功）/ error（失败）/ none（无结果，纯调用）
  const status: "pending" | "ok" | "error" | "none" = pending
    ? "pending"
    : result
      ? isError
        ? "error"
        : "ok"
      : "none";

  return (
    <div
      className={`code-tool-action is-${status}`}
      data-tool={toolCall.name}
      title={formatArguments(toolCall.arguments)}
    >
      <span className="code-tool-action__icon">
        <ToolIcon name={toolCall.name} />
      </span>
      <span className="code-tool-action__verb">{verb}</span>
      {target ? (
        <>
          <span className="code-tool-action__sep">·</span>
          <code className="code-tool-action__target">{target}</code>
        </>
      ) : null}
      <span className="code-tool-action__status" aria-hidden="true">
        {status === "pending" ? (
          <Loader2 size={11} className="animate-spin" />
        ) : status === "ok" ? (
          <CheckCircle2 size={11} />
        ) : status === "error" ? (
          <AlertTriangle size={11} />
        ) : null}
      </span>
    </div>
  );
}
