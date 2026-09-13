import { useId, useState } from "react";
import {
  ChevronDown,
  Clock3,
  Loader2,
  Search,
} from "lucide-react";
import {
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
  // 默认折叠：只展示「思考中 / 已思考」概览，用户需要时再点开看推理与步骤。
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

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
  const decision = routingDecision ?? null;

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
    <section aria-label="思考过程">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-controls={detailId}
        aria-expanded={expanded}
        className="-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-ink-tertiary transition-colors hover:bg-black/[0.025] hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/35"
      >
        {isThinking ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : null}
        <span className="text-xs font-medium">
          {isThinking ? "思考中" : "已思考"}
          {progressText}
        </span>
        {hasRoutingDecision ? (
          <span className="text-[11px]">· {decision?.selected.length ?? 0} 个能力</span>
        ) : null}
        {isSearching ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-apple-blue">
            <Search className="h-2.5 w-2.5" aria-hidden="true" />
            搜索中
          </span>
        ) : null}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div
          id={detailId}
          className="ml-1 space-y-3 border-l border-black/[0.08] pb-1 pl-3"
        >
          {/* Searching indicator */}
          {isSearching && (
            <div className="flex items-center gap-2 text-xs text-apple-blue">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              正在搜索：{searchingQuery}
            </div>
          )}

          {/* Routing Decision Banner */}
          {decision ? (
            <RoutingDecisionBanner decision={decision} />
          ) : null}

          {/* Execution Timeline (when waves info is available) */}
          {useTimelineView && decision ? (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
                执行时间线
              </div>
              <ExecutionTimeline
                runs={runs}
                executionWaves={decision.execution_waves}
                isThinking={isThinking}
              />
            </div>
          ) : null}

          {/* Reasoning content */}
          {hasReasoning && (
            <p className="whitespace-pre-wrap text-xs leading-5 text-ink-secondary">
              {thought}
            </p>
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
                      className="border-t border-black/[0.06] py-2 first:border-t-0"
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
    </section>
  );
}
