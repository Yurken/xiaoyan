import type { Dispatch, SetStateAction } from "react";
import { Check, X } from "lucide-react";
import type { AddSubmissionFormState } from "./shared";

interface AddSubmissionModalProps {
  open: boolean;
  form: AddSubmissionFormState;
  onClose: () => void;
  onSetForm: Dispatch<SetStateAction<AddSubmissionFormState>>;
  onSubmit: () => void | Promise<void>;
}

export default function AddSubmissionModal({
  open,
  form,
  onClose,
  onSetForm,
  onSubmit,
}: AddSubmissionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
      >
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rc-border)" }}>
          <h2 className="text-lg font-bold text-ink-primary">新增投稿</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
            <X className="w-5 h-5 text-ink-tertiary" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1">
              论文标题 <span style={{ color: "#FF3B30" }}>*</span>
            </p>
            <input
              type="text"
              placeholder="输入论文标题…"
              value={form.title}
              onChange={(event) => onSetForm((currentForm) => ({ ...currentForm, title: event.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
              autoFocus
            />
          </div>

          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1.5">投稿类型</p>
            <div className="flex gap-2">
              {(["conference", "journal"] as const).map((venueType) => (
                <button
                  key={venueType}
                  onClick={() => onSetForm((currentForm) => ({ ...currentForm, venueType }))}
                  className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                  style={
                    form.venueType === venueType
                      ? { background: venueType === "conference" ? "#007AFF" : "#AF52DE", color: "#fff" }
                      : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-secondary)" as string }
                  }
                >
                  {venueType === "conference" ? "会议" : "期刊"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1">
              {form.venueType === "conference" ? "会议名称" : "期刊名称"}
              <span style={{ color: "#FF3B30" }}> *</span>
            </p>
            <input
              type="text"
              placeholder={form.venueType === "conference" ? "如：NeurIPS 2026" : "如：JMLR"}
              value={form.venue}
              onChange={(event) => onSetForm((currentForm) => ({ ...currentForm, venue: event.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
            />
          </div>

          {form.venueType === "conference" ? (
            <div>
              <p className="text-xs font-medium text-ink-secondary mb-1">投稿截止日期</p>
              <input
                type="date"
                value={form.deadline}
                onChange={(event) => onSetForm((currentForm) => ({ ...currentForm, deadline: event.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
              />
            </div>
          ) : null}
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors"
            style={{ color: "var(--rc-text-secondary)" as string }}
          >
            取消
          </button>
          <button
            onClick={() => void onSubmit()}
            disabled={!form.title.trim() || !form.venue.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
            style={{ background: "#007AFF", color: "#fff" }}
          >
            <Check className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
