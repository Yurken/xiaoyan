import { ArrowRight, RefreshCcw } from "lucide-react";
import { CCF_STYLE, type RejectionRecoveryPlan, type RejectionRecoveryTarget } from "./shared";

interface RejectionRecoveryPanelProps {
  plans: RejectionRecoveryPlan[];
  onPrepareTransfer: (plan: RejectionRecoveryPlan, target: RejectionRecoveryTarget) => void;
}

export default function RejectionRecoveryPanel({
  plans,
  onPrepareTransfer,
}: RejectionRecoveryPanelProps) {
  if (plans.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl p-4" style={{ background: "var(--rc-card-bg)", boxShadow: "var(--rc-flat-shadow)" }}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
          <RefreshCcw className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-primary">拒稿转投工作流</p>
          <p className="text-xs text-ink-tertiary">把已投入的审稿反馈和版本资产转成下一轮投稿计划。</p>
        </div>
      </div>

      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.submission.id}
            className="rounded-2xl p-3"
            style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-primary">{plan.submission.title}</p>
                <p className="mt-1 text-xs leading-5 text-ink-secondary">{plan.summary}</p>
              </div>
              <span className="flex-shrink-0 rounded-lg bg-apple-red/10 px-2 py-1 text-[10px] font-semibold text-apple-red">
                已拒稿
              </span>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-xl px-3 py-2" style={{ background: "var(--rc-card-bg)" }}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">下一步</p>
                <ul className="space-y-1">
                  {plan.actions.map((action) => (
                    <li key={action} className="text-xs leading-5 text-ink-secondary">
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                {plan.targets.map((target) => {
                  const ccfStyle = CCF_STYLE[target.ccf];
                  return (
                    <div
                      key={`${plan.submission.id}-${target.id}`}
                      className="flex items-start gap-3 rounded-xl px-3 py-2"
                      style={{ background: "var(--rc-card-bg)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-ink-primary">{target.name}</span>
                          {target.ccf !== "none" ? (
                            <span
                              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                              style={{ background: ccfStyle.bg, color: ccfStyle.color }}
                            >
                              CCF {target.ccf}
                            </span>
                          ) : null}
                          {target.sci ? (
                            <span className="rounded-md bg-apple-green/10 px-1.5 py-0.5 text-[10px] font-bold text-apple-green">
                              SCI{target.sciQuartile ? ` ${target.sciQuartile}` : ""}
                            </span>
                          ) : null}
                          <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] text-ink-tertiary">
                            {target.type === "conference" ? "会议" : "期刊"}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-ink-tertiary">{target.fullName}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-secondary">{target.reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPrepareTransfer(plan, target)}
                        className="flex flex-shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium"
                        style={{ background: "rgba(0,122,255,0.12)", color: "#007AFF" }}
                      >
                        转投
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
