import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileArchive, RefreshCw, X } from "lucide-react";
import { Button, ConfirmDialog, IconButton, Input, Select } from "@research-copilot/ui";
import type {
  LatexTemplate,
  WritingDraft,
  WritingResearchInterestSummary,
  WritingTemplateId,
} from "./shared";
import { writingResearchInterestTitle } from "./shared";
import WritingDraftList from "./WritingDraftList";

interface WritingDraftManagerModalProps {
  open: boolean;
  drafts: WritingDraft[];
  activeDraftId: string;
  projectName: string;
  researchInterestId: string;
  interests: WritingResearchInterestSummary[];
  loadingInterests: boolean;
  interestError: string;
  templates: LatexTemplate[];
  templateId: WritingTemplateId;
  onClose: () => void;
  onDraftChange: (id: string) => void;
  onCreateDraft: () => void;
  onDeleteDraft: (id: string) => void;
  onProjectNameChange: (value: string) => void;
  onResearchInterestChange: (value: string) => void;
  onTemplateChange: (templateId: WritingTemplateId) => void;
  onReset: () => void;
}

export default function WritingDraftManagerModal({
  open,
  drafts,
  activeDraftId,
  projectName,
  researchInterestId,
  interests,
  loadingInterests,
  interestError,
  templates,
  templateId,
  onClose,
  onDraftChange,
  onCreateDraft,
  onDeleteDraft,
  onProjectNameChange,
  onResearchInterestChange,
  onTemplateChange,
  onReset,
}: WritingDraftManagerModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<WritingTemplateId | null>(null);
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

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

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
    <>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-5"
        style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(8px)" }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border"
          style={{
            background: "var(--rc-modal-bg)",
            borderColor: "var(--rc-border)",
            boxShadow: "var(--rc-modal-shadow)",
          }}
        >
          <header className="flex shrink-0 items-center gap-3 border-b px-5 py-4" style={{ borderColor: "var(--rc-border)" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue">
              <FileArchive className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-bold text-ink-primary">文稿管理</h2>
              <p className="mt-0.5 truncate text-xs text-ink-tertiary">{projectName}</p>
            </div>
            <IconButton ref={closeButtonRef} size="sm" aria-label="关闭文稿管理" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </header>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(20rem,1.08fr)]">
            <section className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-ink-primary">当前文稿配置</p>
              </div>

              <Input
                label="文稿 / 项目名称"
                value={projectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                placeholder="my-paper"
                className="h-9 text-sm"
              />

              <div className="space-y-1.5">
                <Select
                  label="关联研究主题"
                  value={researchInterestId}
                  onChange={onResearchInterestChange}
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

              <div className="space-y-1.5">
                <Select
                  label="LaTeX 模板"
                  value={templateId}
                  onChange={(value) => setTemplateToApply(value as WritingTemplateId)}
                  options={templates.map((template) => ({ value: template.id, label: template.title }))}
                />
                <p className="px-1 text-[10px] leading-relaxed text-ink-tertiary">
                  {templates.find((template) => template.id === templateId)?.description}
                </p>
              </div>

              <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--rc-border)" }}>
                <Button type="button" size="sm" variant="secondary" onClick={() => setResetConfirmOpen(true)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  重置当前文稿
                </Button>
              </div>
            </section>

            <WritingDraftList
              drafts={drafts}
              activeDraftId={activeDraftId}
              activeResearchInterestId={researchInterestId}
              interests={interests}
              className="min-h-0"
              listClassName="max-h-[50vh] overflow-y-auto pr-1"
              onSelectDraft={onDraftChange}
              onCreateDraft={onCreateDraft}
              onDeleteDraft={onDeleteDraft}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="确认重置当前文稿？"
        description="重置操作将清空当前文稿的源码、引用和便签内容，并恢复为默认模板。此操作无法撤销。"
        confirmLabel="确认重置"
        tone="danger"
        onConfirm={() => {
          onReset();
          setResetConfirmOpen(false);
        }}
        onClose={() => setResetConfirmOpen(false)}
      />

      <ConfirmDialog
        open={templateToApply !== null}
        title="更换 LaTeX 模板？"
        description={`确认要更换为「${templates.find((template) => template.id === templateToApply)?.title}」模板吗？这将覆盖您当前在 main.tex 和 references.bib 中的所有修改。`}
        confirmLabel="确认更换"
        onConfirm={() => {
          if (templateToApply) onTemplateChange(templateToApply);
          setTemplateToApply(null);
        }}
        onClose={() => setTemplateToApply(null)}
      />
    </>
  );
}
