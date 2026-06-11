import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import { Badge, Button, Input, MarkdownRenderer, Select } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { IS_MACOS_DESKTOP, MACOS_WINDOW_DRAG_HEIGHT } from "../../lib/windowChrome";
import { interestFolderName } from "../../lib/interestUtils";
import MarkdownEditor from "./MarkdownEditor";

export function sourceLabel(sourceType: string) {
  if (sourceType === "manual") return "手动";
  if (sourceType === "paper_analysis") return "论文分析";
  if (sourceType === "survey") return "综述";
  return sourceType || "未知来源";
}

export default function NoteDetailModal({
  note,
  linkedClaimCount,
  interests,
  interestMap,
  onClose,
  onSave,
  onDelete,
}: {
  note: KnowledgeNote;
  linkedClaimCount: number;
  interests: ResearchInterest[];
  interestMap: Record<string, ResearchInterest>;
  onClose: () => void;
  onSave: (id: string, draft: { title: string; content: string; research_interest_id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [draft, setDraft] = useState({
    title: note.title,
    content: note.content,
    research_interest_id: note.research_interest_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(note.id, draft);
      setMode("read");
    } catch {
      // Error state is rendered by the parent workspace.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await onDelete(note.id);
      handleClose();
    } catch {
      // Error state is rendered by the parent workspace.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: visible ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0)", transition: "background 0.28s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #F3F6FA 0%, var(--rc-surface) 100%)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          paddingTop: IS_MACOS_DESKTOP ? MACOS_WINDOW_DRAG_HEIGHT : 0,
        }}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-6 py-4"
          style={{ background: "linear-gradient(180deg, var(--rc-surface), var(--rc-surface))", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm text-ink-tertiary transition-colors hover:text-ink-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="flex items-center gap-2">
            {mode === "read" ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </Button>
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-tertiary">确认删除？</span>
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white bg-apple-red transition-colors hover:bg-apple-red/90"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink-primary"
                    >
                      <X className="h-3.5 w-3.5" />
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
                )}
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => setMode("read")}>
                  取消
                </Button>
                <Button size="sm" loading={saving} onClick={() => void handleSave()}>
                  保存
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {mode === "read" ? (
            <>
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{sourceLabel(note.source_type)}</Badge>
                {linkedClaimCount > 0 ? (
                  <Badge variant="info">支撑 {linkedClaimCount} 条结论</Badge>
                ) : null}
                {note.research_interest_id && interestMap[note.research_interest_id] && (
                  <span className="rc-accent-chip rounded-full px-2.5 py-0.5 text-[11px]">
                    {interestFolderName(interestMap[note.research_interest_id])}
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-tertiary">
                  {new Date(note.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-xl font-bold text-ink-primary leading-snug">{note.title}</h1>

              {/* Tags — AI only */}
              {note.source_type !== "manual" && note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-500">小妍</span>
                  {note.tags.map((tag, i) => (
                    <span key={`${note.id}-${tag}-${i}`} className="rc-accent-chip rounded-full px-2.5 py-1 text-[11px]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div
                className="rounded-3xl px-5 py-4 text-sm leading-relaxed"
                style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
              >
                {note.content.trim() ? (
                  <MarkdownRenderer content={note.content} />
                ) : (
                  <p className="text-ink-tertiary">暂无内容</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Input
                label="标题"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="知识卡片标题"
              />
              <div className="space-y-1">
                <label className="ml-1 block text-xs font-medium text-ink-tertiary">研究主题</label>
                <Select
                  value={draft.research_interest_id}
                  onChange={(value) => setDraft((prev) => ({ ...prev, research_interest_id: value }))}
                  options={[{ value: "", label: "未归档" }, ...interests.map((item) => ({
                    value: item.id,
                    label: item.folder_name?.trim() || item.topic,
                  }))]}
                />
              </div>
              <MarkdownEditor
                label="内容"
                value={draft.content}
                onChange={(v) => setDraft((prev) => ({ ...prev, content: v }))}
                placeholder="补充关键结论、方法差异或后续问题。"
                rows={14}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
