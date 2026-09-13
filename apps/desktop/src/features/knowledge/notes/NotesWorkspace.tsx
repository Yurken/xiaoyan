import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, Globe } from "lucide-react";
import { Button, ConfirmDialog } from "@research-copilot/ui";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import NoteImportZip from "../NoteImportZip";
import WebClipDialog from "../WebClipDialog";
import { useKnowledgeNotesWorkspace } from "../useKnowledgeNotesWorkspace";
import { useNotesExport } from "../useNotesExport";
import NoteDocumentPane from "./NoteDocumentPane";
import NotesNavigation from "./NotesNavigation";
import NoteTitleList from "./NoteTitleList";
import { compareNotesByUpdatedAt, type NoteDraft, type NotesScope } from "./shared";

interface NotesWorkspaceProps {
  hideFolders?: boolean;
  researchInterestId?: string;
  initialNotes?: KnowledgeNote[];
  initialInterests?: ResearchInterest[];
  linkedNoteClaimCounts?: Record<string, number>;
  onNotesChanged?: () => void | Promise<void>;
}

export default function NotesWorkspace({
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
    saveNote,
    deleteNote,
    clipWebPage,
    importZip,
  } = useKnowledgeNotesWorkspace({ researchInterestId, initialNotes, initialInterests, onNotesChanged });
  const [scope, setScope] = useState<NotesScope>(researchInterestId ? `interest:${researchInterestId}` : "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [continueEditingId, setContinueEditingId] = useState<string | null>(null);
  const [showWebClip, setShowWebClip] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { exporting, exportError, exportMarkdown } = useNotesExport();

  useEffect(() => {
    if (researchInterestId) setScope(`interest:${researchInterestId}`);
  }, [researchInterestId]);

  const visibleNotes = useMemo(() => scopedNotes
    .filter((note) => {
      if (researchInterestId) return true;
      if (scope === "unfiled") return !note.research_interest_id || !interestMap[note.research_interest_id];
      if (scope.startsWith("interest:")) return note.research_interest_id === scope.slice("interest:".length);
      return true;
    })
    .sort(compareNotesByUpdatedAt), [interestMap, researchInterestId, scope, scopedNotes]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );

  useEffect(() => {
    if (creating) return;
    if (selectedNote && visibleNotes.some((note) => note.id === selectedNote.id)) return;
    setSelectedId(visibleNotes[0]?.id ?? null);
  }, [creating, selectedNote, visibleNotes]);

  const currentInterestId = scope.startsWith("interest:") ? scope.slice("interest:".length) : researchInterestId;

  const handleSelect = (note: KnowledgeNote) => {
    setCreating(false);
    setContinueEditingId(null);
    setSelectedId(note.id);
  };

  const handleCreate = () => {
    clearError();
    setSearch("");
    setSelectedId(null);
    setContinueEditingId(null);
    setCreating(true);
  };

  const handleCreated = (note: KnowledgeNote) => {
    setCreating(false);
    setContinueEditingId(note.id);
    setSelectedId(note.id);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteNote(pendingDelete.id);
      if (selectedId === pendingDelete.id) setSelectedId(null);
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
        <div>
          <h1 className="text-base font-semibold text-ink-primary">知识笔记</h1>
          <p className="mt-1 text-xs text-ink-tertiary">阅读、编辑和整理研究过程中的笔记。</p>
        </div>
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

      <div className={hideFolders
        ? "grid min-w-0 gap-5 md:grid-cols-[250px_minmax(0,1fr)]"
        : "grid min-w-0 gap-5 md:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[190px_270px_minmax(0,1fr)]"
      }>
        {!hideFolders ? (
          <div className="hidden min-w-0 pt-2 xl:block">
            <NotesNavigation interests={interests} scope={scope} onScopeChange={(nextScope) => { setScope(nextScope); setSearch(""); }} />
          </div>
        ) : null}

        <NoteTitleList
          notes={visibleNotes}
          selectedId={selectedId}
          search={search}
          loading={loading}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          onCreate={handleCreate}
        />

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
          onCreated={handleCreated}
          onDelete={setPendingDelete}
        />
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
          onClipped={(note) => { setShowWebClip(false); handleSelect(note); }}
          onClose={() => setShowWebClip(false)}
        />
      ) : null}
    </div>
  );
}
