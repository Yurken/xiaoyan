import { useState } from "react";
import { Check, FileText, Info, Pencil, Save, Trash2 } from "lucide-react";
import { Badge, Button, MarkdownRenderer, Select } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { interestFolderName } from "../../../lib/interestUtils";
import MarkdownSplitEditor from "../MarkdownSplitEditor";
import { useResolvedNoteContent } from "../useResolvedNoteContent";
import { buildInterestOptions, sourceLabel } from "../notesShared";
import { formatNoteUpdatedAt, type NoteDraft, type NoteSaveState } from "./shared";
import { useNoteEditorSession } from "./useNoteEditorSession";

const SAVE_LABELS: Record<NoteSaveState, string> = {
  clean: "",
  draft: "草稿已保存在本机",
  saving: "保存中…",
  saved: "已保存",
  error: "保存失败，草稿已保留",
};

export default function NoteDocumentPane({
  note,
  creating,
  initialEditing = false,
  defaultInterestId,
  interests,
  linkedClaimCount,
  onCreate,
  onSave,
  onCreated,
  onDelete,
}: {
  note: KnowledgeNote | null;
  creating: boolean;
  initialEditing?: boolean;
  defaultInterestId?: string;
  interests: ResearchInterest[];
  linkedClaimCount: number;
  onCreate: (draft: NoteDraft) => Promise<KnowledgeNote>;
  onSave: (id: string, draft: NoteDraft) => Promise<KnowledgeNote>;
  onCreated: (note: KnowledgeNote) => void;
  onDelete: (note: KnowledgeNote) => void;
}) {
  const [editing, setEditing] = useState(creating || initialEditing);
  const [showDetails, setShowDetails] = useState(false);
  const { draft, updateDraft, dirty, saveState, saveError, saveNow } = useNoteEditorSession({
    note,
    creating,
    defaultInterestId,
    onCreate,
    onSave,
    onCreated,
  });
  const resolvedContent = useResolvedNoteContent(draft.content);
  const selectedInterest = interests.find((interest) => interest.id === draft.research_interest_id);

  if (!note && !creating) {
    return (
      <section className="flex min-h-[560px] items-center justify-center rounded-3xl border text-center" style={{
        background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-shadow)",
      }}>
        <div className="max-w-xs px-6">
          <FileText className="mx-auto h-7 w-7 text-ink-tertiary" />
          <p className="mt-4 text-sm font-medium text-ink-secondary">选择一篇笔记开始阅读</p>
        </div>
      </section>
    );
  }

  const statusText = saveState === "clean" && note ? formatNoteUpdatedAt(note.updated_at) : SAVE_LABELS[saveState];

  return (
    <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-3xl border" style={{
      background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-card-shadow)",
    }}>
      <header className="flex flex-wrap items-center gap-2 border-b px-5 py-3" style={{ borderColor: "var(--rc-border)" }}>
        <span className="mr-auto flex items-center gap-1.5 text-xs text-ink-tertiary" role="status">
          {saveState === "saved" ? <Check className="h-3.5 w-3.5 text-apple-green" /> : null}
          {statusText}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setShowDetails((value) => !value)} aria-pressed={showDetails}>
          <Info className="h-3.5 w-3.5" />详情
        </Button>
        {note ? (
          <Button size="sm" variant="ghost" onClick={() => onDelete(note)}>
            <Trash2 className="h-3.5 w-3.5" />删除
          </Button>
        ) : null}
        {editing ? (
          <>
            <Button size="sm" variant="secondary" disabled={!dirty || saveState === "saving"} onClick={() => void saveNow()}>
              <Save className="h-3.5 w-3.5" />保存
            </Button>
            <Button size="sm" onClick={() => { void saveNow(); setEditing(false); }}>
              完成编辑
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />编辑
          </Button>
        )}
      </header>

      {saveError ? <div className="mx-5 mt-4 rounded-2xl px-4 py-2 text-xs text-apple-red" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>{saveError}</div> : null}

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_auto]">
        <article className="min-w-0 overflow-y-auto px-6 py-7 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[780px]">
            {editing ? (
              <>
                <input
                  aria-label="笔记标题"
                  value={draft.title}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  placeholder="无标题笔记"
                  className="mb-5 w-full rounded-2xl border bg-transparent px-4 py-3 text-2xl font-semibold tracking-tight text-ink-primary outline-none placeholder:text-ink-tertiary/60"
                  style={{ borderColor: "var(--rc-control-border)", background: "var(--rc-control-bg)", boxShadow: "var(--rc-control-shadow)" }}
                />
                <div className="h-[430px] min-h-0">
                  <MarkdownSplitEditor
                    key={note?.id ?? "new"}
                    value={draft.content}
                    onChange={(content) => updateDraft({ content })}
                    placeholder="记录关键结论、实验观察或待验证的问题。"
                    label="正文"
                    defaultView="edit"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {selectedInterest ? (
                    <Badge variant="default">{interestFolderName(selectedInterest)}</Badge>
                  ) : <Badge variant="default">未归档</Badge>}
                  {note ? <span className="text-xs text-ink-tertiary">{sourceLabel(note.source_type)}</span> : null}
                </div>
                <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink-primary">{draft.title || "无标题笔记"}</h1>
                <div className="mt-8 text-[15px] leading-7 text-ink-primary">
                  {draft.content.trim() ? <MarkdownRenderer content={resolvedContent} /> : <p className="text-ink-tertiary">这篇笔记还没有正文。</p>}
                </div>
              </>
            )}
          </div>
        </article>

        {showDetails ? (
          <aside className="w-full border-t p-5 xl:w-64 xl:border-l xl:border-t-0" style={{ borderColor: "var(--rc-border)" }}>
            <div className="rounded-3xl p-4" style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-card-inset-shadow)" }}>
              <h2 className="text-sm font-semibold text-ink-primary">笔记详情</h2>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-tertiary">研究主题</label>
                  <Select value={draft.research_interest_id} onChange={(value) => updateDraft({ research_interest_id: value })} options={buildInterestOptions(interests, "未归档")} />
                </div>
                {note ? <div><p className="text-xs text-ink-tertiary">来源</p><p className="mt-1 text-sm text-ink-secondary">{sourceLabel(note.source_type)}</p></div> : null}
                {linkedClaimCount > 0 ? <div><p className="text-xs text-ink-tertiary">知识图谱</p><p className="mt-1 text-sm text-ink-secondary">支撑 {linkedClaimCount} 条结论</p></div> : null}
                {note?.tags?.length ? <div><p className="text-xs text-ink-tertiary">标签</p><p className="mt-1 text-sm text-ink-secondary">{note.tags.join("、")}</p></div> : null}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
