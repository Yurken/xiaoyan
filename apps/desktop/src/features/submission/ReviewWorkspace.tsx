import { BookOpen, CheckCircle2, Circle, Plus, Sparkles } from "lucide-react";
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
    <div className="flex gap-5 h-full min-h-0">
      <div className="w-52 flex-shrink-0 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">投稿论文</p>
        {submissions.map((submission) => {
          const active = submission.id === reviewSubId;
          const statusStyle = STATUS_CFG[submission.status];
          const commentCount = commentCounts[submission.id] ?? 0;

          return (
            <button
              key={submission.id}
              onClick={() => onSelectSubmission(submission.id)}
              className="w-full text-left rounded-2xl p-3 transition-all duration-150"
              style={
                active
                  ? { background: "#007AFF", color: "#fff", boxShadow: "2px 4px 12px rgba(0,122,255,0.3)" }
                  : {
                      background: "var(--rc-card-bg)",
                      color: "var(--rc-text-primary)" as string,
                      boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                    }
              }
            >
              <p className="text-sm font-medium line-clamp-2 leading-snug">{submission.title}</p>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-[10px] truncate" style={{ opacity: 0.65 }}>
                  {submission.venue}
                </span>
                {commentCount > 0 ? (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                    style={
                      active
                        ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                        : { background: statusStyle.bg, color: statusStyle.color }
                    }
                  >
                    {commentCount} 条
                  </span>
                ) : (
                  <span className="text-[10px] opacity-40 flex-shrink-0">暂无</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-ink-primary line-clamp-1">{currentSub?.title}</p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              {subRounds.length} 轮审稿 · {commentCounts[reviewSubId] ?? 0} 条意见
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onOpenCoverLetter}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
              style={{ background: "rgba(52,199,89,0.12)", color: "#34C759" }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Cover Letter
            </button>
            <button
              onClick={onOpenAddReview}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
              style={{ background: "#007AFF", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              录入审稿意见
            </button>
          </div>
        </div>

        {subRounds.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {subRounds.map((round) => {
              const verdictStyle = VERDICT_CFG[round.verdict];
              return (
                <button
                  key={round.round}
                  onClick={() => onSelectRound(round.round)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                  style={
                    reviewRound === round.round
                      ? {
                          background: verdictStyle.bg,
                          color: verdictStyle.color,
                          boxShadow: "var(--rc-chip-shadow)",
                        }
                      : {
                          background: "var(--rc-card-bg)",
                          color: "var(--rc-text-secondary)" as string,
                          boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                        }
                  }
                >
                  第 {round.round} 轮
                  <span className="font-semibold">{verdictStyle.label}</span>
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
                    border: `1px solid ${comment.resolved ? "var(--rc-border)" : "rgba(255,149,0,0.3)"}`,
                    background: "var(--rc-card-bg)",
                    boxShadow: "2px 2px 8px rgba(0,0,0,0.06)",
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
                    <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1.5">作者回复</p>
                    <textarea
                      rows={2}
                      placeholder="记录对该条意见的回复或处理方案..."
                      value={comment.response}
                      onChange={(event) => onUpdateResponse(comment.id, event.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs resize-none leading-relaxed"
                      style={{
                        background: "var(--rc-card-inset-bg)",
                        boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.08)",
                        color: "var(--rc-text-primary)" as string,
                      }}
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
