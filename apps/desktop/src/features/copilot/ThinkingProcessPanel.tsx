import { useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import {
  toCapabilityModelName,
  type AgentPlanStep,
  type AgentRun,
  type RoutingDecision,
} from "@research-copilot/types";
import { AgentRunDetailCard } from "./AgentRunDetailCard";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { RoutingDecisionBanner } from "./RoutingDecisionBanner";

interface ThinkingProcessPanelProps {
  thought: string;
  plan: AgentPlanStep[];
  runs: AgentRun[];
  routingDecision?: RoutingDecision | null;
  searchingQuery: string | null;
  isThinking: boolean;
}

export default function ThinkingProcessPanel({
  thought,
  plan,
  runs,
  routingDecision,
  searchingQuery,
  isThinking,
}: ThinkingProcessPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const hasReasoning = thought.trim().length > 0;
  const hasPlan = plan.length > 0;
  const hasRuns = runs.length > 0;
  const isSearching = !!searchingQuery;
  const hasRoutingDecision = !!routingDecision;
  const hasExecutionWaves =
    routingDecision?.execution_waves &&
    routingDecision.execution_waves.length > 0;
  const hasContent =
    hasReasoning || hasPlan || hasRuns || isSearching || hasRoutingDecision;

  if (!hasContent) return null;

  const doneCount = runs.filter((r) => r.status === "done").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;
  const totalCount = plan.length || runs.length;

  // Build progress text
  let progressText = "";
  if (totalCount > 0) {
    const parts: string[] = [`${doneCount}/${totalCount} 完成`];
    if (failedCount > 0) parts.push(`${failedCount} 失败`);
    progressText = ` (${parts.join("，")})`;
  }

  // Determine if we should use timeline view
  const useTimelineView = hasExecutionWaves && hasRuns;

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
          {hasRoutingDecision && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              style={{
                background: "rgba(175,82,222,0.08)",
                color: "#AF52DE",
              }}
            >
              {routingDecision!.selected.length} 个能力已调度
            </span>
          )}
          {isSearching && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
            >
              <Search className="w-2.5 h-2.5" />
              搜索中
            </span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5 text-ink-tertiary transition-transform duration-200"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
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

          {/* Routing Decision Banner */}
          {hasRoutingDecision && (
            <RoutingDecisionBanner decision={routingDecision!} />
          )}

          {/* Execution Timeline (when waves info is available) */}
          {useTimelineView && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                执行时间线
              </div>
              <ExecutionTimeline
                runs={runs}
                executionWaves={routingDecision!.execution_waves}
                isThinking={isThinking}
              />
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
                style={{
                  background: "var(--rc-surface)",
                  boxShadow: "var(--rc-inset-shadow)",
                }}
              >
                {thought}
              </div>
            </div>
          )}

          {/* Plan steps with detailed cards */}
          {hasPlan && !useTimelineView && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                当前步骤
              </div>
              <div className="space-y-1.5">
                {plan.map((step, index) => {
                  const run = [...runs]
                    .reverse()
                    .find((item) => item.agent_name === step.agent_name);

                  if (run) {
                    // Show detailed card when we have run data
                    return (
                      <AgentRunDetailCard
                        key={`${step.agent_name}-${index}`}
                        run={run}
                        index={index}
                      />
                    );
                  }

                  // Fallback: plan step without run data yet
                  return (
                    <div
                      key={`${step.agent_name}-${index}`}
                      className="rounded-xl px-3 py-2"
                      style={{
                        background: "var(--rc-surface)",
                        boxShadow: "var(--rc-inset-shadow)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-primary">
                          {index + 1}. {step.title}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            color: "#8E8E93",
                            background: "rgba(142,142,147,0.12)",
                          }}
                        >
                          <Clock3 className="w-3 h-3" />
                          待处理
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">
                        {step.goal}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Runs without plan and without timeline */}
          {hasRuns && !hasPlan && !useTimelineView && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                工具与产物
              </div>
              <div className="space-y-1.5">
                {runs.map((run, index) => (
                  <AgentRunDetailCard key={run.id} run={run} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
