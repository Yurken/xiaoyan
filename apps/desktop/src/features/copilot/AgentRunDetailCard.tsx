import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Timer,
  XCircle,
} from "lucide-react";
import { toCapabilityModelName, type AgentRun } from "@research-copilot/types";

interface AgentRunDetailCardProps {
  run: AgentRun;
  index?: number;
}

function statusTone(status: AgentRun["status"]) {
  if (status === "done") {
    return {
      color: "#34C759",
      background: "rgba(52,199,89,0.12)",
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "已完成",
    };
  }
  if (status === "failed") {
    return {
      color: "#FF3B30",
      background: "rgba(255,59,48,0.12)",
      icon: <XCircle className="w-3 h-3" />,
      label: "失败",
    };
  }
  if (status === "running") {
    return {
      color: "#FF9500",
      background: "rgba(255,149,0,0.12)",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: "处理中",
    };
  }
  return {
    color: "#8E8E93",
    background: "rgba(142,142,147,0.12)",
    icon: <Clock3 className="w-3 h-3" />,
    label: "待处理",
  };
}

function formatDuration(ms?: number | null): string | null {
  if (ms == null || ms <= 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds - minutes * 60;
  return `${minutes}m ${remainingSec.toFixed(0)}s`;
}

export function AgentRunDetailCard({ run, index }: AgentRunDetailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tone = statusTone(run.status);
  const duration = formatDuration(run.duration_ms);
  const hasDetail =
    run.input_summary ||
    run.output_summary ||
    (run.upstream_agents && run.upstream_agents.length > 0) ||
    run.structured_output ||
    run.error;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "var(--rc-surface)",
        boxShadow: "var(--rc-inset-shadow)",
      }}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((prev) => !prev)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${hasDetail ? "cursor-pointer hover:bg-black/[0.02]" : "cursor-default"}`}
      >
        {/* Index dot or status icon */}
        <span
          className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
          style={{ background: tone.background, color: tone.color }}
        >
          {index != null ? (
            <span className="text-[10px] font-bold">{index + 1}</span>
          ) : (
            tone.icon
          )}
        </span>

        {/* Agent name */}
        <span className="text-xs font-semibold text-ink-primary flex-1 min-w-0 truncate">
          {toCapabilityModelName(run.agent_name)}
        </span>

        {/* Duration */}
        {duration && (
          <span className="flex items-center gap-0.5 text-[10px] text-ink-tertiary flex-shrink-0">
            <Timer className="w-2.5 h-2.5" />
            {duration}
          </span>
        )}

        {/* Status badge */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] flex-shrink-0"
          style={{ color: tone.color, background: tone.background }}
        >
          {tone.icon}
          {tone.label}
        </span>

        {/* Expand chevron */}
        {hasDetail && (
          <ChevronDown
            className="w-3 h-3 text-ink-tertiary transition-transform duration-200 flex-shrink-0"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        )}
      </button>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-3 pb-2.5 space-y-2">
          {/* Upstream agents */}
          {run.upstream_agents && run.upstream_agents.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-ink-tertiary">输入来源：</span>
              {run.upstream_agents.map((agent) => (
                <span
                  key={agent}
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
                >
                  {toCapabilityModelName(agent)}
                </span>
              ))}
            </div>
          )}

          {/* Input summary */}
          {run.input_summary && (
            <div>
              <div className="text-[10px] font-semibold text-ink-tertiary mb-0.5">
                读取的上游数据
              </div>
              <div
                className="rounded-lg px-2.5 py-1.5 text-[11px] leading-4 text-ink-secondary whitespace-pre-wrap"
                style={{ background: "rgba(0,122,255,0.04)" }}
              >
                {run.input_summary}
              </div>
            </div>
          )}

          {/* Output summary */}
          {run.output_summary && (
            <div>
              <div className="text-[10px] font-semibold text-ink-tertiary mb-0.5">
                产出摘要
              </div>
              <div
                className="rounded-lg px-2.5 py-1.5 text-[11px] leading-4 text-ink-secondary whitespace-pre-wrap"
                style={{ background: "rgba(52,199,89,0.04)" }}
              >
                {run.output_summary}
              </div>
            </div>
          )}

          {/* Error */}
          {run.error && (
            <div>
              <div className="text-[10px] font-semibold text-apple-red mb-0.5">
                错误信息
              </div>
              <div
                className="rounded-lg px-2.5 py-1.5 text-[11px] leading-4 text-apple-red whitespace-pre-wrap"
                style={{ background: "rgba(255,59,48,0.04)" }}
              >
                {run.error}
              </div>
            </div>
          )}

          {/* Structured output */}
          {run.structured_output && (
            <StructuredOutputView data={run.structured_output} />
          )}
        </div>
      )}
    </div>
  );
}

/** Render structured output as compact chips / lists */
function StructuredOutputView({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const entries = Object.entries(data).filter(
    ([, value]) => value != null && value !== "" && (Array.isArray(value) ? value.length > 0 : true),
  );
  if (entries.length === 0) return null;

  return (
    <div>
      <div className="text-[10px] font-semibold text-ink-tertiary mb-1">
        结构化输出
      </div>
      <div className="space-y-1.5">
        {entries.map(([key, value]) => (
          <StructuredField key={key} label={formatFieldLabel(key)} value={value} />
        ))}
      </div>
    </div>
  );
}

function StructuredField({ label, value }: { label: string; value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div>
        <div className="text-[10px] text-ink-tertiary mb-0.5">
          {label} ({value.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 8).map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] truncate max-w-[200px]"
              style={{ background: "var(--rc-surface)", color: "var(--rc-text-secondary, #666)" }}
            >
              {typeof item === "string" ? item : JSON.stringify(item).slice(0, 60)}
            </span>
          ))}
          {value.length > 8 && (
            <span className="text-[10px] text-ink-tertiary self-center">
              +{value.length - 8} 更多
            </span>
          )}
        </div>
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    return (
      <div>
        <div className="text-[10px] text-ink-tertiary mb-0.5">{label}</div>
        <div
          className="rounded-lg px-2 py-1 text-[10px] text-ink-secondary font-mono leading-3.5 overflow-x-auto"
          style={{ background: "var(--rc-surface)" }}
        >
          {JSON.stringify(value, null, 0).slice(0, 200)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] text-ink-tertiary">{label}:</span>
      <span className="text-[10px] text-ink-secondary">{String(value)}</span>
    </div>
  );
}

function formatFieldLabel(key: string): string {
  const labelMap: Record<string, string> = {
    action_items: "行动建议",
    paper_references: "论文引用",
    analysis_highlights: "分析要点",
    key_findings: "主要发现",
    methodology: "方法论",
    limitations: "局限性",
    next_steps: "下一步",
  };
  if (labelMap[key]) return labelMap[key];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
