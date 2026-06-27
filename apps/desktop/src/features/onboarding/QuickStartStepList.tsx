import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import type { QuickStartStep } from "./quickStart";

function StepStatus({ step }: { step: QuickStartStep }) {
  // 可选步骤是「让用户决定」的开关，不打绿勾以免被误读为待办任务。
  if (step.optional) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-medium leading-none"
        style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)" }}
      >
        可选
      </span>
    );
  }
  return step.done ? (
    <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
  ) : (
    <Circle className="w-4 h-4 text-ink-tertiary" />
  );
}

export default function QuickStartStepList({
  steps,
  onStepAction,
}: {
  steps: QuickStartStep[];
  onStepAction?: (step: QuickStartStep) => void;
}) {
  return (
    <div className="grid gap-3">
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.key}
            className="rounded-3xl border px-4 py-4"
            style={{ background: "var(--rc-surface)", borderColor: "var(--rc-border)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
                >
                  <Icon className="w-4.5 h-4.5 text-[#007AFF]" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StepStatus step={step} />
                    <p className="text-sm font-semibold text-ink-primary">{step.title}</p>
                  </div>
                  <p className="text-xs leading-5 text-ink-secondary">{step.description}</p>
                </div>
              </div>

              {onStepAction ? (
                <button
                  type="button"
                  onClick={() => onStepAction(step)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
                  style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
                >
                  {step.actionLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
