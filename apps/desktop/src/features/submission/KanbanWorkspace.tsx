import { FilePlus, Trophy, Users } from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import RejectionRecoveryPanel from "./RejectionRecoveryPanel";
import SubmissionTimelineStrip from "./SubmissionTimelineStrip";
import {
  KANBAN_COLS,
  STATUS_CFG,
  getDaysUntil,
  getDdlStyle,
  type RejectionRecoveryPlan,
  type RejectionRecoveryTarget,
  type Submission,
} from "./shared";

interface KanbanWorkspaceProps {
  submissions: Submission[];
  rejectionRecoveryPlans: RejectionRecoveryPlan[];
  onOpenAddSubmission: () => void;
  onMoveSubmission: (id: string, direction: "prev" | "next") => void;
  onPrepareTransfer: (plan: RejectionRecoveryPlan, target: RejectionRecoveryTarget) => void;
}

export default function KanbanWorkspace({
  submissions,
  rejectionRecoveryPlans,
  onOpenAddSubmission,
  onMoveSubmission,
  onPrepareTransfer,
}: KanbanWorkspaceProps) {
  const copyBibtex = (submission: Submission) => {
    const year = new Date().getFullYear();
    const entryType = submission.venueType === "journal" ? "@article" : "@inproceedings";
    const venueKey = submission.venueType === "journal" ? "journal" : "booktitle";
    const key = `Author${year}${submission.venue.split(" ")[0]}`;
    const bibtex = `${entryType}{${key},\n  title={${submission.title}},\n  author={},\n  ${venueKey}={${submission.venue}},\n  year={${year}}\n}`;
    void navigator.clipboard.writeText(bibtex);
  };

  return (
    <div className="space-y-4 h-full">
      <Card padding="sm" variant="flat" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-tertiary">点击「推进」更新论文投稿进度</p>
        <Button variant="secondary" size="sm" onClick={onOpenAddSubmission}>
          <FilePlus className="w-3.5 h-3.5" />
          新增投稿
        </Button>
      </Card>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLS.map(({ key, label }, columnIndex) => {
          const statusConfig = STATUS_CFG[key];
          const items = submissions.filter((submission) => submission.status === key);

          return (
            <div
              key={key}
              className="flex-shrink-0 w-56 rounded-3xl p-3"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-card-inset-shadow)" }}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: statusConfig.color }} />
                  <span className="text-sm font-semibold text-ink-primary">{label}</span>
                </div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: statusConfig.bg, color: statusConfig.color }}
                >
                  {items.length}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[120px]">
                {items.map((submission) => (
                  <Card
                    padding="sm"
                    variant="flat"
                    key={submission.id}
                    className="cursor-default transition-transform duration-150 hover:-translate-y-px"
                  >
                    <p className="text-sm font-medium text-ink-primary leading-snug line-clamp-3">{submission.title}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{
                          background: submission.venueType === "conference" ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                          color: submission.venueType === "conference" ? "#007AFF" : "#AF52DE",
                        }}
                      >
                        {submission.venueType === "conference" ? "会议" : "期刊"}
                      </span>
                      <p className="text-[11px] text-ink-tertiary truncate">{submission.venue}</p>
                    </div>
                    {submission.deadline && key === "writing" && submission.venueType === "conference" ? (
                      <p className="mt-1 text-[11px]" style={{ color: getDdlStyle(getDaysUntil(submission.deadline)).color }}>
                        DDL 还剩 {getDaysUntil(submission.deadline)} 天
                      </p>
                    ) : null}
                    {submission.submittedAt ? (
                      <p className="mt-1 text-[11px] text-ink-tertiary">
                        投稿于 {submission.submittedAt.toLocaleDateString("zh-CN")}
                      </p>
                    ) : null}
                    <SubmissionTimelineStrip submission={submission} />
                    {key === "accepted" ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" style={{ color: "#34C759" }} />
                          <span className="text-[11px] font-medium" style={{ color: "#34C759" }}>已录用</span>
                        </div>
                        <button
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors"
                          style={{ background: "rgba(52,199,89,0.12)", color: "#34C759" }}
                          onClick={() => copyBibtex(submission)}
                          title="复制 BibTeX"
                        >
                          BibTeX
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-2.5 flex gap-1">
                      {columnIndex > 0 ? (
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[10px] text-ink-tertiary transition-colors hover:bg-[var(--rc-button-ghost-bg-hover)] hover:text-ink-secondary"
                          onClick={() => onMoveSubmission(submission.id, "prev")}
                        >
                          回退
                        </button>
                      ) : null}
                      {key !== "accepted" && key !== "rejected" ? (
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:bg-[var(--rc-info-chip-bg-hover)]"
                          style={{ color: "var(--rc-info-chip-text)" }}
                          onClick={() => onMoveSubmission(submission.id, "next")}
                        >
                          推进
                        </button>
                      ) : null}
                    </div>
                  </Card>
                ))}

                {items.length === 0 ? (
                  <div
                    className="flex min-h-[88px] items-center justify-center rounded-2xl border p-5 opacity-55"
                    style={{ borderColor: "var(--rc-card-inset-outline)" }}
                  >
                    <p className="text-xs text-ink-tertiary">暂无</p>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <RejectionRecoveryPanel
        plans={rejectionRecoveryPlans}
        onPrepareTransfer={onPrepareTransfer}
      />

      <div
        className="rounded-3xl border p-4 flex items-center gap-3 opacity-60"
        style={{ background: "var(--rc-card-inset-bg)", borderColor: "var(--rc-card-inset-outline)" }}
      >
        <Users className="w-5 h-5 text-ink-tertiary flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-ink-secondary">多人协作（即将上线）</p>
          <p className="text-xs text-ink-tertiary mt-0.5">邀请共同作者加入投稿项目，分配章节任务、标注评论、共享看板进度。</p>
        </div>
      </div>
    </div>
  );
}
