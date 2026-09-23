import { useState, type ReactNode } from "react";
import { AlertCircle, Download, Globe } from "lucide-react";
import { Button, ConfirmDialog } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import NoteImportZip from "../NoteImportZip";
import WebClipDialog from "../WebClipDialog";
import { useKnowledgeNotesWorkspace } from "../useKnowledgeNotesWorkspace";
import { useNotesExport } from "../useNotesExport";
import NoteDocumentPane from "./NoteDocumentPane";
import NotesSidebar from "./NotesSidebar";
import type { NoteDraft } from "./shared";
import { useNotesSelection } from "./useNotesSelection";

interface NotesWorkspaceProps {
  toolbarStart?: ReactNode;
  hideFolders?: boolean;
  researchInterestId?: string;
  initialNotes?: KnowledgeNote[];
  initialInterests?: ResearchInterest[];
  linkedNoteClaimCounts?: Record<string, number>;
  onNotesChanged?: () => void | Promise<void>;
}

export default function NotesWorkspace({
  toolbarStart,
  hideFolders = false,
  researchInterestId,
  initialNotes,
  initialInterests,
  linkedNoteClaimCounts,
  onNotesChanged,
}: NotesWorkspaceProps) {
  const {
    notes,
    interests,
    search,
    setSearch,
    loading,
    error,
    clearError,
    scopedNotes,
    interestMap,
    createNote,
    acceptCreatedNote,
    saveNote,
    deleteNote,
    clipWebPage,
    importZip,
  } = useKnowledgeNotesWorkspace({ researchInterestId, initialNotes, initialInterests, onNotesChanged });
  const {
    scope,
    visibleNotes,
    selectedNote,
    selectedId,
    creating,
    continueEditingId,
    currentInterestId,
    selectedOutsideFilter,
    changeScope,
    selectNote,
    startCreate,
    selectCreatedNote,
  } = useNotesSelection({ notes, scopedNotes, interestMap, researchInterestId, setSearch });
  const [showWebClip, setShowWebClip] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { exporting, exportError, exportMarkdown } = useNotesExport();

  const handleCreate = () => {
    clearError();
    startCreate();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteNote(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      // The workspace hook exposes the error and keeps the dialog open for retry.
    } finally {
      setDeleting(false);
    }
  };

  const createFromDraft = (draft: NoteDraft) => createNote({
    ...draft,
    research_interest_id: draft.research_interest_id || undefined,
  });

  return (
    <div className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        {toolbarStart ? <div className="min-w-0">{toolbarStart}</div> : <span />}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={!selectedNote || exporting} loading={exporting} onClick={() => { if (selectedNote) void exportMarkdown([selectedNote], interestMap); }}>
            <Download className="h-3.5 w-3.5" />导出当前笔记
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowWebClip(true)}>
            <Globe className="h-3.5 w-3.5" />剪辑网页
          </Button>
          <NoteImportZip interests={interests} researchInterestId={currentInterestId} onImport={importZip} />
        </div>
      </div>

      {error || exportError ? (
        <div className="mb-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm text-apple-red" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || exportError}</span>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <NotesSidebar
          notes={visibleNotes}
          interests={interests}
          scope={scope}
          selectedId={selectedId}
          search={search}
          loading={loading}
          showScopeFilter={!hideFolders && !researchInterestId}
          onScopeChange={changeScope}
          onSearchChange={setSearch}
          onSelect={selectNote}
          onCreate={handleCreate}
        />

        <div className="min-w-0 space-y-3">
          {selectedOutsideFilter ? (
            <p role="status" className="rounded-2xl px-4 py-3 text-sm text-ink-secondary" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
              当前笔记不在筛选结果中
            </p>
          ) : null}
          <NoteDocumentPane
            key={creating ? "new" : selectedNote?.id ?? "empty"}
            note={selectedNote}
            creating={creating}
            initialEditing={selectedNote?.id === continueEditingId}
            defaultInterestId={currentInterestId}
            interests={interests}
            linkedClaimCount={selectedNote ? linkedNoteClaimCounts?.[selectedNote.id] ?? 0 : 0}
            onCreate={createFromDraft}
            onSave={saveNote}
            onCreated={(note) => { acceptCreatedNote(note); selectCreatedNote(note); }}
            onDelete={setPendingDelete}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        title="删除笔记"
        description={pendingDelete ? `确认删除「${pendingDelete.title}」？此操作不可撤销。` : ""}
        confirmLabel="删除"
        tone="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
      />

      {showWebClip ? (
        <WebClipDialog
          interests={interests}
          defaultInterestId={currentInterestId ?? ""}
          lockInterest={Boolean(researchInterestId)}
          onClip={clipWebPage}
          onClipped={(note) => { setShowWebClip(false); selectNote(note); }}
          onClose={() => setShowWebClip(false)}
        />
      ) : null}
    </div>
  );
}
