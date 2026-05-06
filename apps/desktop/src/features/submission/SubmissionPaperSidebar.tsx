import type { ReactNode } from "react";
import type { Submission } from "./shared";

interface SubmissionPaperSidebarProps {
  submissions: Submission[];
  selectedSubmissionId: string;
  onSelectSubmission: (submissionId: string) => void;
  renderMeta: (submission: Submission, active: boolean) => ReactNode;
}

export default function SubmissionPaperSidebar({
  submissions,
  selectedSubmissionId,
  onSelectSubmission,
  renderMeta,
}: SubmissionPaperSidebarProps) {
  return (
    <aside className="w-56 flex-shrink-0">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">投稿论文</p>
      <div
        className="space-y-2 rounded-3xl p-2"
        style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-card-inset-shadow)" }}
      >
        {submissions.map((submission) => {
          const active = submission.id === selectedSubmissionId;

          return (
            <button
              key={submission.id}
              type="button"
              onClick={() => onSelectSubmission(submission.id)}
              className="w-full rounded-2xl p-3 text-left transition-all duration-150 hover:-translate-y-px"
              style={
                active
                  ? {
                      background: "var(--rc-button-primary-bg)",
                      border: "1px solid var(--rc-button-primary-border)",
                      boxShadow: "var(--rc-button-primary-shadow)",
                      color: "#fff",
                    }
                  : {
                      background: "var(--rc-chip-bg)",
                      border: "1px solid var(--rc-card-outline)",
                      boxShadow: "var(--rc-chip-shadow)",
                      color: "var(--rc-text)",
                    }
              }
            >
              <p className="line-clamp-2 text-sm font-medium leading-snug">{submission.title}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[10px]" style={{ opacity: active ? 0.74 : 0.62 }}>
                  {submission.venue}
                </span>
                {renderMeta(submission, active)}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
