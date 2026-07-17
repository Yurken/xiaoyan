import { useEffect } from "react";
import { Compass, X } from "lucide-react";
import type { QuickStartStep } from "./quickStart";
import QuickStartStepList from "./QuickStartStepList";

interface QuickStartDialogProps {
  open: boolean;
  steps: QuickStartStep[];
  onGotoSettings: () => void;
  onClose: () => void;
}

export default function QuickStartDialog({ open, steps, onGotoSettings, onClose }: QuickStartDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="快速开始"
        className="w-full max-w-xl rounded-[28px] border p-5"
        style={{
          background: "var(--rc-elevated, var(--rc-surface))",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-card-shadow)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "color-mix(in srgb, #34C759 16%, transparent)", color: "#34C759" }}
            >
              <Compass className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink-primary">快速开始</h2>
              <p className="text-xs leading-5 text-ink-tertiary">
                先做两件必填的事——接通小妍、按需补任务分工；最后一项步骤协作是可选开关，由你决定要不要开。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--rc-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <QuickStartStepList steps={steps} onStepAction={() => onGotoSettings()} />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95"
            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            稍后再说
          </button>
          <button
            type="button"
            onClick={onGotoSettings}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: "var(--rc-button-primary-bg)" }}
          >
            去完善设置
          </button>
        </div>
      </div>
    </div>
  );
}
