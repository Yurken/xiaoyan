import type { Dispatch, SetStateAction } from "react";
import { Check, X } from "lucide-react";
import type { SaveVersionFormState } from "./shared";

interface SaveVersionModalProps {
  open: boolean;
  versionNextTag: string;
  form: SaveVersionFormState;
  onClose: () => void;
  onSetForm: Dispatch<SetStateAction<SaveVersionFormState>>;
  onSubmit: () => void | Promise<void>;
}

export default function SaveVersionModal({
  open,
  versionNextTag,
  form,
  onClose,
  onSetForm,
  onSubmit,
}: SaveVersionModalProps) {
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
        className="w-full max-w-xl mx-4 rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
      >
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rc-border)" }}>
          <div>
            <h2 className="text-lg font-bold text-ink-primary">记录版本快照</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">保存当前稿件内容，防止修改丢失</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
            <X className="w-5 h-5 text-ink-tertiary" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="flex gap-3">
            <div>
              <p className="text-xs font-medium text-ink-secondary mb-1">版本号</p>
              <input
                type="text"
                placeholder={versionNextTag}
                value={form.tag}
                onChange={(event) => onSetForm((currentForm) => ({ ...currentForm, tag: event.target.value }))}
                className="w-24 px-3 py-2 rounded-xl text-sm font-bold"
                style={{
                  background: "var(--rc-card-inset-bg)",
                  color: "#007AFF",
                  boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)",
                }}
              />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-ink-secondary mb-1">
                版本标签 <span style={{ color: "#FF3B30" }}>*</span>
              </p>
              <input
                type="text"
                placeholder="如：初稿、按审稿意见修改、camera-ready…"
                value={form.label}
                onChange={(event) => onSetForm((currentForm) => ({ ...currentForm, label: event.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1">修改说明</p>
            <textarea
              rows={2}
              placeholder="简述本版本的主要改动…"
              value={form.notes}
              onChange={(event) => onSetForm((currentForm) => ({ ...currentForm, notes: event.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1">
              摘要 / 核心内容 <span style={{ color: "#FF3B30" }}>*</span>
            </p>
            <textarea
              rows={7}
              placeholder="粘贴当前版本的摘要或核心内容，用于后续 diff 对比…"
              value={form.content}
              onChange={(event) => onSetForm((currentForm) => ({ ...currentForm, content: event.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none font-mono leading-relaxed"
              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
            />
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-black/5"
            style={{ color: "var(--rc-text-secondary)" as string }}
          >
            取消
          </button>
          <button
            onClick={() => void onSubmit()}
            disabled={!form.label.trim() || !form.content.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
            style={{ background: "#007AFF", color: "#fff" }}
          >
            <Check className="w-4 h-4" />
            保存版本
          </button>
        </div>
      </div>
    </div>
  );
}
