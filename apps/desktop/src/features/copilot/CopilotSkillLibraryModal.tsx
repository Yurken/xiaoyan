import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "@research-copilot/ui";
import type { Skill } from "@research-copilot/types";
import SkillLibraryPanel from "../skills/SkillLibraryPanel";
import { useCopilotSkillLibraryFocus } from "./useCopilotSkillLibraryFocus";

export default function CopilotSkillLibraryModal({ open, onClose, onSkillsChange }: {
  open: boolean;
  onClose: () => void;
  onSkillsChange: (skills: Skill[]) => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useCopilotSkillLibraryFocus(open, dialogRef, closeRef);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(6px)" }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || !(event.target instanceof Element) || event.target.closest('[role="dialog"]') !== dialog) return;
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Tab") {
          const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
            .filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-2rem)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-3xl border"
        style={{ background: "var(--rc-modal-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-modal-shadow)" }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "var(--rc-border)" }}>
          <h2 id={titleId} className="text-base font-semibold text-ink-primary">技能库管理</h2>
          <IconButton ref={closeRef} size="sm" aria-label="关闭技能库" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
          <SkillLibraryPanel onSkillsChange={onSkillsChange} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
