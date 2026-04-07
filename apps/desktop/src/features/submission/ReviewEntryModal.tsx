import type { Dispatch, SetStateAction } from "react";
import { Check, X } from "lucide-react";
import { REVIEW_TAGS, VERDICT_CFG, type ReviewFormState, type ReviewRound, type ReviewVerdict } from "./shared";

interface ReviewEntryModalProps {
  open: boolean;
  currentVenue?: string;
  reviewRound: number;
  reviewRounds: ReviewRound[];
  reviewSubId: string;
  reviewForm: ReviewFormState;
  onClose: () => void;
  onSetReviewForm: Dispatch<SetStateAction<ReviewFormState>>;
  onSubmit: () => void | Promise<void>;
}

export default function ReviewEntryModal({
  open,
  currentVenue,
  reviewRound,
  reviewRounds,
  reviewSubId,
  reviewForm,
  onClose,
  onSetReviewForm,
  onSubmit,
}: ReviewEntryModalProps) {
  if (!open) {
    return null;
  }

  const roundExists = reviewRounds.some((round) => round.submissionId === reviewSubId && round.round === reviewRound);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
      >
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rc-border)" }}>
          <div>
            <h2 className="text-lg font-bold text-ink-primary">录入审稿意见</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              第 {reviewRound} 轮 · {currentVenue}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
            <X className="w-5 h-5 text-ink-tertiary" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {!roundExists ? (
            <div>
              <p className="text-xs font-medium text-ink-secondary mb-1.5">本轮结论</p>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(VERDICT_CFG) as [ReviewVerdict, (typeof VERDICT_CFG)[ReviewVerdict]][]).map(
                  ([verdict, verdictStyle]) => (
                    <button
                      key={verdict}
                      onClick={() => onSetReviewForm((currentForm) => ({ ...currentForm, verdict }))}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
                      style={
                        reviewForm.verdict === verdict
                          ? { background: verdictStyle.color, color: "#fff" }
                          : { background: verdictStyle.bg, color: verdictStyle.color }
                      }
                    >
                      {verdictStyle.label}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1">审稿人</p>
            <input
              type="text"
              placeholder="如：Reviewer 1、AC、Meta-Reviewer"
              value={reviewForm.reviewer}
              onChange={(event) => onSetReviewForm((currentForm) => ({ ...currentForm, reviewer: event.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
              autoFocus
            />
          </div>

          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1">
              审稿意见 <span style={{ color: "#FF3B30" }}>*</span>
            </p>
            <textarea
              rows={6}
              placeholder="粘贴审稿人的原始意见…"
              value={reviewForm.content}
              onChange={(event) => onSetReviewForm((currentForm) => ({ ...currentForm, content: event.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none leading-relaxed"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1.5">意见分类</p>
            <div className="flex flex-wrap gap-1.5">
              {REVIEW_TAGS.map((tag) => {
                const active = reviewForm.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      onSetReviewForm((currentForm) => ({
                        ...currentForm,
                        tags: active ? currentForm.tags.filter((currentTag) => currentTag !== tag) : [...currentForm.tags, tag],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                    style={
                      active
                        ? { background: "#007AFF", color: "#fff" }
                        : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-secondary)" as string }
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <p className="text-xs text-ink-tertiary">保存后可继续录入同轮其他审稿人意见</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors"
              style={{ color: "var(--rc-text-secondary)" as string }}
            >
              完成
            </button>
            <button
              onClick={() => void onSubmit()}
              disabled={!reviewForm.reviewer.trim() || !reviewForm.content.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
              style={{ background: "#007AFF", color: "#fff" }}
            >
              <Check className="w-4 h-4" />
              保存并继续
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
