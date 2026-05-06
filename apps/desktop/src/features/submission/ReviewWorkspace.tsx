import { BookOpen, CheckCircle2, Circle, Plus, Sparkles } from "lucide-react";
import { Button, Textarea } from "@research-copilot/ui";
import SubmissionPaperSidebar from "./SubmissionPaperSidebar";
import type { ReviewComment, ReviewRound, Submission } from "./shared";
import { STATUS_CFG, VERDICT_CFG } from "./shared";

interface ReviewWorkspaceProps {
  submissions: Submission[];
  reviewComments: ReviewComment[];
  reviewRounds: ReviewRound[];
  reviewSubId: string;
  reviewRound: number;
  onSelectSubmission: (submissionId: string) => void;
  onSelectRound: (round: number) => void;
  onOpenCoverLetter: () => void;
  onOpenAddReview: () => void;
  onToggleResolved: (commentId: string) => void;
  onUpdateResponse: (commentId: string, response: string) => void;
}

export default function ReviewWorkspace({
  submissions,
  reviewComments,
  reviewRounds,
  reviewSubId,
  reviewRound,
  onSelectSubmission,
  onSelectRound,
  onOpenCoverLetter,
  onOpenAddReview,
  onToggleResolved,
  onUpdateResponse,
}: ReviewWorkspaceProps) {
  const currentSub = submissions.find((submission) => submission.id === reviewSubId);
  const subRounds = reviewRounds
    .filter((round) => round.submissionId === reviewSubId)
    .sort((left, right) => left.round - right.round);
  const activeRound = subRounds.find((round) => round.round === reviewRound);
  const roundComments = reviewComments
    .filter((comment) => comment.submissionId === reviewSubId && comment.round === reviewRound)
    .sort((left, right) => left.reviewer.localeCompare(right.reviewer));
  const unresolvedCount = roundComments.filter((comment) => !comment.resolved).length;
  const commentCounts = reviewComments.reduce<Record<string, number>>((counts, comment) => {
    counts[comment.submissionId] = (counts[comment.submissionId] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 xl:flex-row">
      <SubmissionPaperSidebar
        submissions={submissions}
        selectedSubmissionId={reviewSubId}
        onSelectSubmission={onSelectSubmission}
        renderMeta={(submission, active) => {
          const statusStyle = STATUS_CFG[submission.status];
          const commentCount = commentCounts[submission.id] ?? 0;
          return commentCount > 0 ? (
            <span
              className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              style={
                active
                  ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                  : { background: statusStyle.bg, color: statusStyle.color }
              }
            >
              {commentCount} 条
            </span>
          ) : (
            <span className="flex-shrink-0 text-[10px] opacity-40">暂无</span>
          );
        }}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-ink-primary line-clamp-1">{currentSub?.title}</p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              {subRounds.length} 轮审稿 · {commentCounts[reviewSubId] ?? 0} 条意见
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onOpenCoverLetter}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Cover Letter
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onOpenAddReview}
            >
              <Plus className="w-3.5 h-3.5" />
              录入审稿意见
            </Button>
          </div>
        </div>

        {subRounds.length > 0 ? (
          <div
            className="inline-flex flex-wrap gap-1 rounded-2xl p-1"
            style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-card-inset-shadow)" }}
          >
            {subRounds.map((round) => {
              const verdictStyle = VERDICT_CFG[round.verdict];
              return (
                <button
                  key={round.round}
                  type="button"
                  onClick={() => onSelectRound(round.round)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                  style={
                    reviewRound === round.round
                      ? {
                          background: "var(--rc-elevated)",
                          color: "var(--rc-text)",
                          boxShadow: "var(--rc-raised-shadow)",
                        }
                      : {
                          color: "var(--rc-text-muted)",
                        }
                  }
                >
                  第 {round.round} 轮
                  <span className="font-semibold" style={{ color: reviewRound === round.round ? verdictStyle.color : undefined }}>
                    {verdictStyle.label}
                  </span>
                  <span className="opacity-60">
                    · {round.receivedAt.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {subRounds.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
            <BookOpen className="w-10 h-10 text-ink-tertiary" />
            <p className="text-sm text-ink-tertiary">暂无审稿记录，点击「录入审稿意见」开始归档</p>
          </div>
        ) : roundComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 opacity-40">
            <p className="text-sm text-ink-tertiary">本轮暂无意见</p>
          </div>
        ) : (
          <>
            {activeRound ? (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl" style={{ background: VERDICT_CFG[activeRound.verdict].bg }}>
                <span className="text-sm font-bold" style={{ color: VERDICT_CFG[activeRound.verdict].color }}>
                  {VERDICT_CFG[activeRound.verdict].label}
                </span>
                <span className="text-xs text-ink-secondary">
                  {roundComments.length} 位审稿人 · {unresolvedCount > 0 ? `${unresolvedCount} 条待处理` : "全部已处理 ✓"}
                </span>
              </div>
            ) : null}

            <div className="space-y-3">
              {roundComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl overflow-hidden transition-all duration-150"
                  style={{
                    border: `1px solid ${comment.resolved ? "var(--rc-card-outline)" : "rgba(255,149,0,0.3)"}`,
                    background: "var(--rc-card-bg)",
                    boxShadow: "var(--rc-card-flat-shadow)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      background: comment.resolved ? "var(--rc-card-inset-bg)" : "rgba(255,149,0,0.06)",
                      borderBottom: "1px solid var(--rc-border)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink-primary">{comment.reviewer}</span>
                      {comment.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => onToggleResolved(comment.id)}
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg transition-colors"
                      style={
                        comment.resolved
                          ? { background: "rgba(52,199,89,0.12)", color: "#34C759" }
                          : { background: "rgba(255,149,0,0.12)", color: "#FF9500" }
                      }
                    >
                      {comment.resolved ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> 已处理
                        </>
                      ) : (
                        <>
                          <Circle className="w-3 h-3" /> 待处理
                        </>
                      )}
                    </button>
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-sm text-ink-secondary leading-relaxed">{comment.content}</p>
                  </div>

                  <div className="px-4 pb-3">
                    <Textarea
                      label="作者回复"
                      rows={2}
                      placeholder="记录对该条意见的回复或处理方案..."
                      value={comment.response}
                      onChange={(event) => onUpdateResponse(comment.id, event.target.value)}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
