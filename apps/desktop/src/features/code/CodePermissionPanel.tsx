import { AlertTriangle, Check, Terminal, X } from "lucide-react";
import type { CodePermissionRequest } from "../../lib/client";
import { CodeToolCallCard } from "./CodeToolMessage";

interface CodePermissionPanelProps {
  requests: CodePermissionRequest[];
  onResolve: (permissionId: string, approved: boolean, message?: string) => void;
}

export default function CodePermissionPanel({ requests, onResolve }: CodePermissionPanelProps) {
  if (requests.length === 0) return null;

  const request = requests[0];
  const queued = requests.length - 1;
  const isCommand = request.tool_call.name === "run_command";

  return (
    <div className="code-permission-panel">
      <div className="code-permission-panel__header">
        <div className="code-permission-panel__title">
          {isCommand ? <Terminal size={14} /> : <AlertTriangle size={14} />}
          <span>{request.title}</span>
        </div>
        <span className={`code-permission-panel__risk is-${request.risk_level}`}>
          {request.risk_level === "high" ? "高风险" : "需确认"}
        </span>
      </div>

      <p className="code-permission-panel__summary">{request.summary}</p>
      <CodeToolCallCard toolCall={request.tool_call} />
      {request.preview && (
        <pre className="code-permission-panel__preview">
          <code>{request.preview}</code>
        </pre>
      )}
      {queued > 0 && <p className="code-permission-panel__queued">还有 {queued} 个工具调用等待确认</p>}

      <div className="code-permission-panel__actions">
        <button
          type="button"
          className="code-permission-panel__btn"
          onClick={() => onResolve(request.id, false, "用户拒绝执行该工具调用。")}
        >
          <X size={13} />
          拒绝
        </button>
        <button
          type="button"
          className="code-permission-panel__btn code-permission-panel__btn--primary"
          onClick={() => onResolve(request.id, true)}
        >
          <Check size={13} />
          允许一次
        </button>
      </div>
    </div>
  );
}
