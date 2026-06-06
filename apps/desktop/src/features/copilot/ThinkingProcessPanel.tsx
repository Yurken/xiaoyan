import { useState } from "react";
import { Brain, CheckCircle2, ChevronDown, Clock3, Loader2, Search, XCircle } from "lucide-react";
import type { AgentPlanStep, AgentRun } from "@research-copilot/types";

interface ThinkingProcessPanelProps {
  thought: string;
  plan: AgentPlanStep[];
  runs: AgentRun[];
  searchingQuery: string | null;
  isThinking: boolean;
}

function runTone(status: AgentRun["status"]) {
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
  return {
    color: "#FF9500",
    background: "rgba(255,149,0,0.12)",
    icon: <Clock3 className="w-3 h-3" />,
    label: status === "running" ? "处理中" : "待处理",
  };
}

export default function ThinkingProcessPanel({
  thought,
  plan,
  runs,
  searchingQuery,
  isThinking,
}: ThinkingProcessPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const hasReasoning = thought.trim().length > 0;
  const hasPlan = plan.length > 0;
  const hasRuns = runs.length > 0;
  const isSearching = !!searchingQuery;
  const hasContent = hasReasoning || hasPlan || hasRuns || isSearching;

  if (!hasContent) return null;

  const doneCount = runs.filter((r) => r.status === "done").length;
  const totalCount = plan.length || runs.length;
  const progressText = totalCount > 0 ? ` (${doneCount}/${totalCount})` : "";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--rc-elevated)",
        boxShadow: "var(--rc-inset-shadow)",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isThinking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-tertiary flex-shrink-0" />
          ) : (
            <Brain className="w-3.5 h-3.5 text-ink-tertiary flex-shrink-0" />
          )}
          <span className="text-xs font-semibold text-ink-secondary truncate">
            {isThinking ? "思考中" : "已思考"}
            {progressText}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isSearching && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}>
              <Search className="w-2.5 h-2.5" />
              搜索中
            </span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5 text-ink-tertiary transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Searching indicator */}
          {isSearching && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
              style={{ background: "rgba(0,122,255,0.06)", color: "#007AFF" }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              正在搜索：{searchingQuery}
            </div>
          )}

          {/* Reasoning content */}
          {hasReasoning && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                思考过程
              </div>
              <div
                className="rounded-xl px-3 py-2.5 text-xs leading-5 whitespace-pre-wrap text-ink-secondary"
                style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
              >
                {thought}
              </div>
            </div>
          )}

          {/* Plan steps */}
          {hasPlan && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                当前步骤
              </div>
              <div className="space-y-1.5">
                {plan.map((step, index) => {
                  const run = [...runs]
                    .reverse()
                    .find((item) => item.agent_name === step.agent_name);
                  const tone = runTone(run?.status || "pending");

                  return (
                    <div
                      key={`${step.agent_name}-${index}`}
                      className="rounded-xl px-3 py-2"
                      style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-primary">
                          {index + 1}. {step.title}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                          style={{ color: tone.color, background: tone.background }}
                        >
                          {tone.icon}
                          {tone.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">{step.goal}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agent runs without plan */}
          {hasRuns && !hasPlan && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                工具与产物
              </div>
              <div className="space-y-1.5">
                {runs.map((run) => {
                  const tone = runTone(run.status);
                  return (
                    <div
                      key={run.id}
                      className="rounded-xl px-3 py-2"
                      style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-primary">{run.agent_name}</span>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                          style={{ color: tone.color, background: tone.background }}
                        >
                          {tone.icon}
                          {tone.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
