import {
  AlertTriangle,
  CheckCircle2,
  FilePenLine,
  FileText,
  FolderTree,
  Layers,
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

const TOOL_LABELS: Record<string, string> = {
  read_file: "读取文件",
  list_dir: "列出目录",
  glob_files: "匹配文件",
  search_files: "搜索代码",
  workspace_context: "工作区上下文",
  write_file: "写入文件",
  edit_file: "编辑文件",
  run_command: "执行命令",
};

const AUTO_COLLAPSED_TOOLS = new Set(["read_file", "list_dir", "glob_files", "search_files", "workspace_context"]);

function ToolIcon({ name }: { name: string }) {
  if (name === "read_file") return <FileText size={13} />;
  if (name === "list_dir") return <FolderTree size={13} />;
  if (name === "glob_files") return <FolderTree size={13} />;
  if (name === "search_files") return <Search size={13} />;
  if (name === "workspace_context") return <Layers size={13} />;
  if (name === "write_file" || name === "edit_file") return <FilePenLine size={13} />;
  if (name === "run_command") return <Terminal size={13} />;
  return <Wrench size={13} />;
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
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
  const preferred = args.file_path ?? args.path ?? args.pattern ?? args.command;
  return typeof preferred === "string" ? preferred : "";
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
