import { useState } from "react";
import { ChevronDown, Route, Sparkles } from "lucide-react";
import { toCapabilityModelName, type RoutingDecision } from "@research-copilot/types";

interface RoutingDecisionBannerProps {
  decision: RoutingDecision;
}

const POLICY_LABELS: Record<string, string> = {
  rule: "规则路由",
  llm: "智能路由",
  hybrid: "混合路由",
};

const POLICY_COLORS: Record<string, { color: string; bg: string }> = {
  rule: { color: "#007AFF", bg: "rgba(0,122,255,0.08)" },
  llm: { color: "#AF52DE", bg: "rgba(175,82,222,0.08)" },
  hybrid: { color: "#FF9500", bg: "rgba(255,149,0,0.08)" },
};

export function RoutingDecisionBanner({
  decision,
}: RoutingDecisionBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const policyLabel = POLICY_LABELS[decision.policy] ?? decision.policy;
  const policyStyle = POLICY_COLORS[decision.policy] ?? POLICY_COLORS.rule;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--rc-elevated)",
        boxShadow: "var(--rc-inset-shadow)",
      }}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
      >
        <Route
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: policyStyle.color }}
        />
        <span className="text-xs font-semibold text-ink-secondary flex-1 min-w-0">
          路由决策
        </span>

        {/* Policy badge */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0"
          style={{ color: policyStyle.color, background: policyStyle.bg }}
        >
          {decision.policy === "llm" && <Sparkles className="w-2.5 h-2.5" />}
          {policyLabel}
        </span>

        {/* Selected agents count */}
        <span className="text-[10px] text-ink-tertiary flex-shrink-0">
          {decision.selected.length} 个能力
        </span>

        <ChevronDown
          className="w-3.5 h-3.5 text-ink-tertiary transition-transform duration-200 flex-shrink-0"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Selected agents */}
          <div>
            <div className="text-[10px] font-semibold text-ink-tertiary mb-1">
              已调度能力
            </div>
            <div className="flex flex-wrap gap-1">
              {decision.selected.map((agent) => (
                <span
                  key={agent}
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "rgba(0,122,255,0.08)",
                    color: "#007AFF",
                  }}
                >
                  {toCapabilityModelName(agent)}
                </span>
              ))}
            </div>
          </div>

          {/* Execution waves */}
          {decision.execution_waves &&
            decision.execution_waves.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-ink-tertiary mb-1">
                  执行计划
                </div>
                <div className="space-y-1">
                  {decision.execution_waves.map((wave, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[11px] text-ink-secondary"
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                        style={{
                          background: "rgba(142,142,147,0.08)",
                          color: "#8E8E93",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-ink-tertiary text-[10px]">
                        {wave.length > 1 ? "并行" : ""}
                      </span>
                      {wave.map((agent, j) => (
                        <span key={agent}>
                          <span className="text-ink-secondary">
                            {toCapabilityModelName(agent)}
                          </span>
                          {j < wave.length - 1 && (
                            <span className="text-ink-tertiary mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Reasoning */}
          {decision.reasoning && (
            <div>
              <div className="text-[10px] font-semibold text-ink-tertiary mb-0.5">
                路由理由
              </div>
              <div
                className="rounded-lg px-2.5 py-1.5 text-[11px] leading-4 text-ink-secondary whitespace-pre-wrap"
                style={{ background: "rgba(175,82,222,0.04)" }}
              >
                {decision.reasoning}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
