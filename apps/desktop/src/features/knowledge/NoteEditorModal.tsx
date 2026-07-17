import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Badge, Button, Input, Select } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { interestFolderName } from "../../lib/interestUtils";
import MarkdownSplitEditor from "./MarkdownSplitEditor";
import { buildInterestOptions, sourceLabel } from "./notesShared";

export interface NoteDraft {
  title: string;
  content: string;
  research_interest_id: string;
}

/**
 * 知识卡片编辑弹窗，统一承担「新建」与「查看 / 编辑」：
 * - note 为 null → 新建模式，保存调用 onCreate。
 * - note 存在 → 默认进入预览视图，可随时切到编辑 / 分屏，保存调用 onSave，支持删除。
 * 标题、研究主题始终可编辑，内容区支持编辑 / 预览 / 分屏三种视图。
 */
export default function NoteEditorModal({
  note,
  defaultInterestId = "",
  lockInterest = false,
  linkedClaimCount = 0,
  interests,
  interestMap,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: {
  note: KnowledgeNote | null;
  defaultInterestId?: string;
  lockInterest?: boolean;
  linkedClaimCount?: number;
  interests: ResearchInterest[];
  interestMap: Record<string, ResearchInterest>;
  onClose: () => void;
  onCreate?: (draft: NoteDraft) => Promise<KnowledgeNote>;
  onSave?: (id: string, draft: NoteDraft) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const isCreate = note == null;
  const initial: NoteDraft = {
    title: note?.title ?? "",
    content: note?.content ?? "",
    research_interest_id: note?.research_interest_id ?? defaultInterestId,
  };

  const [draft, setDraft] = useState<NoteDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const dirty = isCreate
    ? draft.title.trim().length > 0 || draft.content.trim().length > 0
    : draft.title !== initial.title
      || draft.content !== initial.content
      || draft.research_interest_id !== initial.research_interest_id;

  const canSave = draft.title.trim().length > 0 && draft.content.trim().length > 0;

  const requestClose = () => {
    setVisible(false);
    setTimeout(onClose, 240);
  };

  // 有未保存改动时，避免点击遮罩 / Esc 误关。
  const handleDismiss = () => {
    if (saving) return;
    if (dirty) return;
    requestClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, dirty]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isCreate) {
        await onCreate?.(draft);
        requestClose();
      } else {
        await onSave?.(note.id, draft);
        requestClose();
      }
    } catch {
      // Error state is rendered by the parent workspace.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await onDelete?.(note.id);
      requestClose();
    } catch {
      // Error state is rendered by the parent workspace.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: visible ? "var(--rc-modal-backdrop)" : "transparent", backdropFilter: "blur(6px)", transition: "background 0.24s ease" }}
      onClick={(event) => { if (event.target === event.currentTarget) handleDismiss(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border"
        style={{
          background: "var(--rc-modal-bg)",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-modal-shadow)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)",
          transition: "opacity 0.24s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-6 py-4"
          style={{ background: "var(--rc-surface)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-primary">
              {isCreate ? "新建知识卡片" : "知识卡片"}
            </h2>
            {!isCreate && <Badge variant="default">{sourceLabel(note.source_type)}</Badge>}
            {!isCreate && linkedClaimCount > 0 ? (
              <Badge variant="info">支撑 {linkedClaimCount} 条结论</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {!isCreate && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-ink-tertiary">确认删除？</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="flex items-center gap-1 rounded-xl bg-apple-red px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-apple-red/90"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink-primary"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-apple-red transition-colors hover:bg-apple-red/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              )
            )}
            <Button size="sm" loading={saving} disabled={!canSave || (!isCreate && !dirty)} onClick={() => void handleSave()}>
              保存
            </Button>
            <button
              type="button"
              onClick={requestClose}
              className="ml-1 rounded-lg p-1.5 text-ink-tertiary transition-colors hover:bg-[var(--rc-list-item-hover-bg)] hover:text-ink-primary"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-5">
          <Input
            label="标题"
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="如：RLHF 中 reward model 的作用"
          />

          <div className="flex flex-wrap items-end gap-3">
            {!lockInterest && (
              <div className="min-w-[220px] flex-1 space-y-1">
                <label className="ml-1 block text-xs font-medium text-ink-tertiary">研究主题</label>
                <Select
                  value={draft.research_interest_id}
                  onChange={(value) => setDraft((prev) => ({ ...prev, research_interest_id: value }))}
                  options={buildInterestOptions(interests, "未归档")}
                />
              </div>
            )}
            {!isCreate && (
              <div className="flex flex-1 flex-wrap items-center gap-2 pb-1.5">
                {note.research_interest_id && interestMap[note.research_interest_id] && (
                  <span className="rc-accent-chip rounded-full px-2.5 py-0.5 text-[11px]">
                    {interestFolderName(interestMap[note.research_interest_id])}
                  </span>
                )}
                {note.source_type !== "manual" && note.tags && note.tags.length > 0 && (
                  <>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-500">小妍</span>
                    {note.tags.map((tag, index) => (
                      <span key={`${note.id}-${tag}-${index}`} className="rc-accent-chip rounded-full px-2.5 py-0.5 text-[11px]">
                        {tag}
                      </span>
                    ))}
                  </>
                )}
                <span className="ml-auto text-xs text-ink-tertiary">
                  {new Date(note.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1">
            <MarkdownSplitEditor
              value={draft.content}
              onChange={(value) => setDraft((prev) => ({ ...prev, content: value }))}
              placeholder="记录关键结论、方法差异、实验观察或待验证的问题。"
              defaultView={isCreate ? "split" : "preview"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
