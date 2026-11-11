import { useId, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button, ConfirmDialog, IconButton, Input, Textarea } from "@research-copilot/ui";
import type { Skill } from "@research-copilot/types";
import { createSkillDraft, RESET_BUILTINS_DESCRIPTION, type SkillDraft } from "./shared";

interface SkillEditModalProps {
  skill: Skill | null;
  saving: boolean;
  resetting: boolean;
  error: string;
  onSave: (draft: SkillDraft) => Promise<void>;
  onReset: () => Promise<Skill | null>;
  onClose: () => void;
}

export function SkillEditModal({
  skill, saving, resetting, error, onSave, onReset, onClose,
}: SkillEditModalProps) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => createSkillDraft(skill));
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const isCreate = skill === null;
  const busy = saving || resetting;
  const setField = (field: keyof SkillDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const resetDraft = async () => {
    const restored = await onReset();
    if (restored) setDraft(createSkillDraft(restored));
    setConfirmResetOpen(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (!(event.target instanceof Element) || event.target.closest('[role="dialog"]') !== event.currentTarget) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    }
    if (event.key === "Tab") {
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
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
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--rc-modal-backdrop)", backdropFilter: "blur(4px)" }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-[28px] border p-4 sm:p-6"
        style={{ background: "var(--rc-modal-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-modal-shadow)" }}
        onKeyDown={handleKeyDown}
        onSubmit={(event) => { event.preventDefault(); if (!busy) void onSave(draft); }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-base font-semibold text-ink-primary">{isCreate ? "新建技能" : "编辑技能"}</h3>
          <IconButton size="sm" disabled={busy} aria-label="关闭技能编辑" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>

        {isCreate ? (
          <Input
            autoFocus
            required
            label="技能标识（唯一名称，用于 /name 触发）"
            value={draft.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="例如：my-skill（英文、数字、连字符）"
            disabled={busy}
          />
        ) : null}
        <Input
          autoFocus={!isCreate}
          required
          label="显示标题"
          value={draft.title}
          onChange={(event) => setField("title", event.target.value)}
          placeholder="例如：我的分析技能"
          disabled={busy}
        />
        <Input
          label="简短描述"
          value={draft.description}
          onChange={(event) => setField("description", event.target.value)}
          placeholder="用一句话说明这个技能的用途"
          disabled={busy}
        />
        <div className="space-y-1.5">
          <Textarea
            label="提示词模板"
            value={draft.prompt}
            onChange={(event) => setField("prompt", event.target.value)}
            rows={8}
            placeholder="在此输入提示词模板，支持 {{变量名}} 占位符…"
            className="font-mono leading-6"
            disabled={busy}
          />
          {skill?.kind === "tool" ? (
            <p className="text-xs leading-5 text-ink-tertiary">工具技能通过专用流程执行；编辑此模板不会改变 PPT 生成流程。</p>
          ) : null}
        </div>
        <Input
          label="标签（逗号 / 顿号分隔）"
          value={draft.tagsInput}
          onChange={(event) => setField("tagsInput", event.target.value)}
          placeholder="例如：论文、分析"
          disabled={busy}
        />
        {error ? <p role="alert" className="flex items-start gap-2 text-xs text-apple-red"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div>
            {skill?.is_builtin ? (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmResetOpen(true)}>
                <RefreshCw className="h-3.5 w-3.5" />重置全部内置
              </Button>
            ) : null}
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>取消</Button>
            <Button type="submit" loading={saving} disabled={resetting}>{isCreate ? "创建" : "保存"}</Button>
          </div>
        </div>
      </form>
      <ConfirmDialog
        open={confirmResetOpen}
        title="重置全部内置技能"
        description={`${RESET_BUILTINS_DESCRIPTION} 当前编辑草稿也会恢复默认。`}
        confirmLabel="确认重置"
        tone="danger"
        loading={resetting}
        onClose={() => { if (!busy) setConfirmResetOpen(false); }}
        onConfirm={() => void resetDraft()}
      />
    </div>,
    document.body,
  );
}
