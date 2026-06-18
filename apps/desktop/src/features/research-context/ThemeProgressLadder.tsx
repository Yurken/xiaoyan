import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { ThemeStage } from "./shared";

interface ThemeProgressLadderProps {
  stages: ThemeStage[];
  percent: number;
}

function nodeClass(state: ThemeStage["state"]): string {
  if (state === "done") return "bg-apple-blue text-white";
  if (state === "active") return "bg-white text-apple-blue ring-2 ring-apple-blue";
  return "bg-black/[0.05] text-ink-tertiary";
}

function labelClass(state: ThemeStage["state"]): string {
  if (state === "active") return "text-ink-primary font-semibold";
  if (state === "done") return "text-ink-secondary";
  return "text-ink-tertiary";
}

export default function ThemeProgressLadder({ stages, percent }: ThemeProgressLadderProps) {
  const doneCount = stages.filter((stage) => stage.state === "done").length;
  const focus = stages.find((stage) => stage.state === "active");

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
          研究进展
        </div>
        <div className="text-xs text-ink-secondary">
          {doneCount}/{stages.length} 阶段 · {percent}%
        </div>
      </div>

      <div className="mt-4 flex items-start">
        {stages.map((stage, index) => {
          const prevDone = index > 0 && stages[index - 1].state === "done";
          return (
            <div key={stage.key} className="relative flex flex-1 flex-col items-center px-1">
              {index > 0 && (
                <span
                  className={`absolute left-[-50%] top-[13px] z-0 h-0.5 w-full ${
                    prevDone ? "bg-apple-blue" : "bg-black/[0.08]"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold shadow-sm ${nodeClass(stage.state)}`}
              >
                {stage.state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={`mt-2 text-center text-[11px] leading-4 ${labelClass(stage.state)}`}>
                {stage.label}
              </span>
              {stage.count !== null && stage.count > 0 && (
                <span className="mt-0.5 text-[10px] text-ink-tertiary">{stage.count}</span>
              )}
            </div>
          );
        })}
      </div>

      {focus ? (
        <div
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-primary">下一步：{focus.label}</p>
            <p className="mt-0.5 truncate text-[11px] text-ink-secondary">{focus.hint}</p>
          </div>
          <Link
            to={focus.to}
            className="flex flex-shrink-0 items-center gap-1 rounded-xl bg-apple-blue px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            去推进
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-medium text-apple-blue"
          style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
        >
          <Sparkles className="h-4 w-4" />
          这个主题已经走完规划到投稿的完整链路，继续打磨成果吧。
        </div>
      )}
    </section>
  );
}
