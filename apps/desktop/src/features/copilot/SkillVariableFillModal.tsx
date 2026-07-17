import { useState } from "react";
import { Wand2, X } from "lucide-react";
import type { PendingSkillFill } from "./useCopilotChat";

interface SkillVariableFillModalProps {
  pending: PendingSkillFill;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export default function SkillVariableFillModal({
  pending,
  onConfirm,
  onCancel,
}: SkillVariableFillModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(4px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-lg rounded-[28px] p-6 space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,122,255,0.12)", color: "#007AFF" }}
            >
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink-primary truncate">
                填写技能变量
              </h3>
              <p className="text-xs text-ink-tertiary mt-0.5 truncate">
                {pending.skill.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-tertiary hover:text-ink-secondary transition-colors flex-shrink-0"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {pending.variables.map((name) => (
            <div key={name} className="space-y-1.5">
              <label className="block text-xs font-medium text-ink-tertiary ml-1">
                {`{{${name}}}`}
              </label>
              <textarea
                value={values[name] ?? ""}
                onChange={(event) => setValue(name, event.target.value)}
                rows={2}
                placeholder={`填写「${name}」的内容…`}
                className="w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none resize-none leading-6"
                style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
              />
            </div>
          ))}
        </div>

        <p className="text-[11px] text-ink-tertiary leading-5">
          留空的变量会保留 <code className="font-mono">{"{{占位符}}"}</code> 原样发送。
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-2xl text-sm font-medium text-ink-secondary transition-all"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(values)}
            className="px-5 py-2 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{
              background: "var(--rc-button-primary-bg)",
              boxShadow: "var(--rc-button-primary-shadow)",
            }}
          >
            填好并发送
          </button>
        </div>
      </div>
    </div>
  );
}
