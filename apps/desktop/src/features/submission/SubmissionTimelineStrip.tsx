import { buildSubmissionTimeline, type Submission } from "./shared";

const stateStyle = {
  done: { bg: "#34C759", text: "#1A7F37", line: "rgba(52,199,89,0.45)" },
  active: { bg: "#007AFF", text: "#007AFF", line: "rgba(0,122,255,0.35)" },
  pending: { bg: "var(--rc-border)", text: "var(--rc-text-tertiary)", line: "var(--rc-border)" },
};

export default function SubmissionTimelineStrip({ submission }: { submission: Submission }) {
  const steps = buildSubmissionTimeline(submission);

  return (
    <div className="mt-3 rounded-xl px-2.5 py-2" style={{ background: "var(--rc-card-inset-bg)" }}>
      <div className="grid grid-cols-4 gap-1">
        {steps.map((step, index) => {
          const style = stateStyle[step.state];
          return (
            <div key={step.key} className="min-w-0">
              <div className="flex items-center">
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: style.bg }} />
                {index < steps.length - 1 ? (
                  <span className="mx-1 h-px flex-1" style={{ background: style.line }} />
                ) : null}
              </div>
              <p className="mt-1 truncate text-[10px] font-semibold" style={{ color: style.text }}>
                {step.label}
              </p>
              <p className="truncate text-[9px] text-ink-tertiary">{step.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
