import { useCallback, useEffect, useMemo, useState } from "react";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { compareNotesByUpdatedAt, type NotesScope } from "./shared";

export function useNotesSelection({
  notes,
  scopedNotes,
  interestMap,
  researchInterestId,
  setSearch,
}: {
  notes: KnowledgeNote[];
  scopedNotes: KnowledgeNote[];
  interestMap: Record<string, ResearchInterest>;
  researchInterestId?: string;
  setSearch: (search: string) => void;
}) {
  const defaultScope: NotesScope = researchInterestId ? `interest:${researchInterestId}` : "all";
  const [selection, setSelection] = useState<{
    contextId?: string;
    scope: NotesScope;
    selectedId: string | null;
    creating: boolean;
    continueEditingId: string | null;
  }>({
    contextId: researchInterestId,
    scope: defaultScope,
    selectedId: null,
    creating: false,
    continueEditingId: null,
  });
  const sameContext = selection.contextId === researchInterestId;
  const scope = sameContext ? selection.scope : defaultScope;
  const creating = sameContext && selection.creating;
  const selectedNote = sameContext
    ? notes.find((note) => note.id === selection.selectedId) ?? null
    : null;
  const visibleNotes = useMemo(() => scopedNotes
    .filter((note) => {
      if (researchInterestId) return true;
      if (scope === "unfiled") return !note.research_interest_id || !interestMap[note.research_interest_id];
      if (scope.startsWith("interest:")) return note.research_interest_id === scope.slice("interest:".length);
      return true;
    })
    .sort(compareNotesByUpdatedAt), [interestMap, researchInterestId, scope, scopedNotes]);

  useEffect(() => {
    if (!sameContext) {
      setSearch("");
      setSelection({
        contextId: researchInterestId,
        scope: defaultScope,
        selectedId: null,
        creating: false,
        continueEditingId: null,
      });
      return;
    }
    // Search and folder filters only change the list. An open document keeps its session.
    if (creating || selectedNote) return;
    const nextId = visibleNotes[0]?.id ?? null;
    setSelection((current) => current.selectedId === nextId ? current : {
      ...current,
      selectedId: nextId,
      continueEditingId: null,
    });
  }, [creating, defaultScope, researchInterestId, sameContext, selectedNote, setSearch, visibleNotes]);

  const changeScope = useCallback((nextScope: NotesScope) => {
    setSearch("");
    setSelection((current) => ({ ...current, scope: nextScope }));
  }, [setSearch]);

  const selectNote = useCallback((note: KnowledgeNote) => {
    setSelection((current) => current.contextId !== researchInterestId ? current : {
      ...current,
      selectedId: note.id,
      creating: false,
      continueEditingId: null,
    });
  }, [researchInterestId]);

  const startCreate = useCallback(() => {
    setSearch("");
    setSelection((current) => ({
      ...current,
      selectedId: null,
      creating: true,
      continueEditingId: null,
    }));
  }, [setSearch]);

  const selectCreatedNote = useCallback((note: KnowledgeNote) => {
    setSelection((current) => current.contextId !== researchInterestId ? current : {
      ...current,
      selectedId: note.id,
      creating: false,
      continueEditingId: note.id,
    });
  }, [researchInterestId]);

  return {
    scope,
    visibleNotes,
    selectedNote,
    selectedId: selectedNote?.id ?? null,
    creating,
    continueEditingId: sameContext ? selection.continueEditingId : null,
    currentInterestId: scope.startsWith("interest:") ? scope.slice("interest:".length) : researchInterestId,
    selectedOutsideFilter: Boolean(selectedNote && !visibleNotes.some((note) => note.id === selectedNote.id)),
    changeScope,
    selectNote,
    startCreate,
    selectCreatedNote,
  };
}
