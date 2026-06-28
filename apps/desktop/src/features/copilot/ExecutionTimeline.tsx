import { toCapabilityModelName, type AgentRun } from "@research-copilot/types";

interface ExecutionTimelineProps {
  runs: AgentRun[];
  executionWaves: string[][];
  isThinking: boolean;
}

function statusColor(status: AgentRun["status"]): string {
  if (status === "done") return "#34C759";
  if (status === "failed") return "#FF3B30";
  if (status === "running") return "#FF9500";
  return "#C7C7CC";
}

function formatMs(ms?: number | null): string {
  if (ms == null || ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
}

export function ExecutionTimeline({
  runs,
  executionWaves,
  isThinking,
}: ExecutionTimelineProps) {
  // Build a lookup from agent_name -> run
  const runByAgent = new Map<string, AgentRun>();
  for (const run of runs) {
    runByAgent.set(run.agent_name, run);
  }

  // Compute max duration for scaling bars
  const maxDuration = Math.max(
    ...runs.map((r) => r.duration_ms ?? 0),
    1, // fallback to avoid division by zero
  );

  // If no waves info, fall back to showing runs in order
  if (!executionWaves || executionWaves.length === 0) {
    if (runs.length === 0) return null;
    return (
      <div className="space-y-1">
        {runs.map((run, i) => (
          <TimelineBar
            key={run.id}
            run={run}
            maxDuration={maxDuration}
            index={i}
          />
        ))}
      </div>
    );
  }

  const totalDuration = runs.reduce(
    (sum, r) => sum + (r.duration_ms ?? 0),
    0,
  );
  const wallTime = computeWallTime(executionWaves, runByAgent);

  return (
    <div>
      {/* Timeline header with summary stats */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] text-ink-tertiary">
          {executionWaves.length} 波次执行
        </span>
        {wallTime > 0 && (
          <span className="text-[10px] text-ink-tertiary">
            总耗时 {formatMs(wallTime)}
          </span>
        )}
        {totalDuration > wallTime && wallTime > 0 && (
          <span
            className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
            style={{ background: "rgba(52,199,89,0.1)", color: "#34C759" }}
          >
            并行节省 {formatMs(totalDuration - wallTime)}
          </span>
        )}
      </div>

      {/* Waves */}
      <div className="space-y-2">
        {executionWaves.map((wave, waveIdx) => (
          <div key={waveIdx}>
            {/* Wave label */}
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: wave.some(
                    (a) => runByAgent.get(a)?.status === "running",
                  )
                    ? "rgba(255,149,0,0.12)"
                    : "rgba(142,142,147,0.08)",
                  color: wave.some(
                    (a) => runByAgent.get(a)?.status === "running",
                  )
                    ? "#FF9500"
                    : "#8E8E93",
                }}
              >
                {waveIdx + 1}
              </span>
              <span className="text-[10px] text-ink-tertiary">
                {wave.length > 1 ? "并行" : "串行"}
                {wave.length > 1 && ` · ${wave.length} 个任务`}
              </span>
              {/* Dependency line */}
              {waveIdx > 0 && (
                <svg
                  className="ml-auto"
                  width="24"
                  height="8"
                  viewBox="0 0 24 8"
                  fill="none"
                >
                  <path
                    d="M0 4h20m0 0l-3-3m3 3l-3 3"
                    stroke="#C7C7CC"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            {/* Wave agents */}
            <div className="space-y-1">
              {wave.map((agentName) => {
                const run = runByAgent.get(agentName);
                if (!run) {
                  // Agent hasn't started yet
                  return (
                    <div
                      key={agentName}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                      style={{
                        background: "var(--rc-surface)",
                        opacity: 0.5,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "#C7C7CC" }}
                      />
                      <span className="text-[11px] text-ink-tertiary flex-1 truncate">
                        {toCapabilityModelName(agentName)}
                      </span>
                      {isThinking && (
                        <span className="text-[10px] text-ink-tertiary">
                          等待中
                        </span>
                      )}
                    </div>
                  );
                }
                return (
                  <TimelineBar
                    key={run.id}
                    run={run}
                    maxDuration={maxDuration}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A single timeline bar showing an agent's execution */
function TimelineBar({
  run,
  maxDuration,
  index,
}: {
  run: AgentRun;
  maxDuration: number;
  index?: number;
}) {
  const duration = run.duration_ms ?? 0;
  const pct = duration > 0 ? Math.max((duration / maxDuration) * 100, 8) : 0;
  const color = statusColor(run.status);

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2 py-1.5"
      style={{ background: "var(--rc-surface)" }}
    >
      {/* Status dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />

      {/* Agent name */}
      <span className="text-[11px] text-ink-primary flex-shrink-0 w-16 truncate" title={toCapabilityModelName(run.agent_name)}>
        {index != null && (
          <span className="text-ink-tertiary mr-0.5">{index + 1}.</span>
        )}
        {toCapabilityModelName(run.agent_name)}
      </span>

      {/* Duration bar */}
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: color,
            opacity: run.status === "running" ? 0.6 : 0.8,
          }}
        />
      </div>

      {/* Duration label */}
      <span className="text-[10px] text-ink-tertiary flex-shrink-0 w-10 text-right tabular-nums">
        {formatMs(duration) || "—"}
      </span>
    </div>
  );
}

/**
 * Compute wall-clock time: for each wave, the wall time is the
 * max duration of any agent in that wave (since they run in parallel).
 */
function computeWallTime(
  waves: string[][],
  runByAgent: Map<string, AgentRun>,
): number {
  let total = 0;
  for (const wave of waves) {
    let waveMax = 0;
    for (const agentName of wave) {
      const run = runByAgent.get(agentName);
      if (run?.duration_ms != null) {
        waveMax = Math.max(waveMax, run.duration_ms);
      }
    }
    total += waveMax;
  }
  return total;
}
