import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Badge, Button, MarkdownRenderer } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { interestFolderName } from "../../lib/interestUtils";
import { sourceLabel } from "../knowledge/notesShared";

export default function PaperNoteViewerModal({
  note,
  interestMap,
  onClose,
  onOpenInKnowledge,
}: {
  note: KnowledgeNote;
  interestMap: Record<string, ResearchInterest>;
  onClose: () => void;
  onOpenInKnowledge: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const requestClose = () => {
    setVisible(false);
    setTimeout(onClose, 240);
  };

  const interest = note.research_interest_id ? interestMap[note.research_interest_id] : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        background: visible ? "var(--rc-modal-backdrop)" : "rgba(23, 25, 29, 0)",
        backdropFilter: "blur(6px)",
        transition: "background 0.24s ease",
      }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border"
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
            <h2 className="text-sm font-semibold text-ink-primary">论文笔记</h2>
            <Badge variant="default">{sourceLabel(note.source_type)}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => { requestClose(); onOpenInKnowledge(); }}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              在知识笔记中查看
            </Button>
            <button
              type="button"
              onClick={requestClose}
              className="rounded-lg p-1.5 text-ink-tertiary transition-colors hover:bg-[var(--rc-list-item-hover-bg)] hover:text-ink-primary"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-semibold text-ink-primary">{note.title}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
            {interest && (
              <span className="rc-accent-chip rounded-full px-2.5 py-0.5 text-[11px]">
                {interestFolderName(interest)}
              </span>
            )}
            {note.tags && note.tags.length > 0 && (
              <>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-500">小妍</span>
                {note.tags.map((tag, index) => (
                  <span key={`${note.id}-${tag}-${index}`} className="rc-accent-chip rounded-full px-2.5 py-0.5 text-[11px]">
                    {tag}
                  </span>
                ))}
              </>
            )}
            <span className="ml-auto">
              {new Date(note.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
            <MarkdownRenderer content={note.content} highlightSourceTags />
          </div>
        </div>
      </div>
    </div>
  );
}
