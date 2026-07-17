import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FilePlus2, X } from "lucide-react";
import { Button, IconButton, Select } from "@research-copilot/ui";
import type {
  LatexTemplate,
  WritingCreateDraftOptions,
  WritingResearchInterestSummary,
  WritingTemplateId,
} from "./shared";
import { writingResearchInterestTitle } from "./shared";

interface WritingNewDraftModalProps {
  open: boolean;
  templates: LatexTemplate[];
  interests: WritingResearchInterestSummary[];
  loadingInterests: boolean;
  interestError: string;
  defaultResearchInterestId: string;
  defaultTemplateId: WritingTemplateId;
  onClose: () => void;
  onCreateDraft: (options: WritingCreateDraftOptions) => void;
}

export default function WritingNewDraftModal({
  open,
  templates,
  interests,
  loadingInterests,
  interestError,
  defaultResearchInterestId,
  defaultTemplateId,
  onClose,
  onCreateDraft,
}: WritingNewDraftModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [researchInterestId, setResearchInterestId] = useState(defaultResearchInterestId);
  const [templateId, setTemplateId] = useState<WritingTemplateId>(defaultTemplateId);
  const interestOptions = useMemo(
    () => [
      { value: "", label: "未绑定研究主题" },
      ...interests.map((interest) => ({
        value: interest.id,
        label: writingResearchInterestTitle(interest),
      })),
    ],
    [interests],
  );
  const selectedTemplate = templates.find((template) => template.id === templateId);

  useEffect(() => {
    if (!open) return;
    setResearchInterestId(defaultResearchInterestId);
    setTemplateId(defaultTemplateId);
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [defaultResearchInterestId, defaultTemplateId, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-[28px] border p-5"
        style={{
          background: "var(--rc-modal-bg)",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-modal-shadow)",
        }}
      >
        <header className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue">
            <FilePlus2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-ink-primary">新增文稿</h2>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              选择模板和研究主题后，小妍会创建并切换到新文稿。
            </p>
          </div>
          <IconButton ref={closeButtonRef} size="sm" aria-label="关闭新增文稿" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Select
              label="LaTeX 模板"
              value={templateId}
              onChange={(value) => setTemplateId(value as WritingTemplateId)}
              options={templates.map((template) => ({ value: template.id, label: template.title }))}
            />
            <p className="px-1 text-[10px] leading-relaxed text-ink-tertiary">
              {selectedTemplate?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <Select
              label="研究主题"
              value={researchInterestId}
              onChange={setResearchInterestId}
              options={interestOptions}
              disabled={loadingInterests && interests.length === 0}
              placeholder="选择研究主题"
            />
            {loadingInterests ? (
              <p className="px-1 text-[10px] leading-relaxed text-ink-tertiary">正在同步研究主题...</p>
            ) : null}
            {interestError ? (
              <p className="px-1 text-[10px] leading-relaxed text-apple-red">{interestError}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button
            type="button"
            onClick={() => {
              onCreateDraft({
                researchInterestId: researchInterestId || undefined,
                templateId,
              });
              onClose();
            }}
          >
            创建文稿
          </Button>
        </div>
      </div>
    </div>
  );
}
