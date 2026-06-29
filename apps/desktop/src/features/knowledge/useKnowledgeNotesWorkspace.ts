import { useCallback, useEffect, useMemo, useState } from "react";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface CreateKnowledgeNoteInput {
  title: string;
  content: string;
  research_interest_id?: string;
}

interface SaveKnowledgeNoteInput {
  title: string;
  content: string;
  research_interest_id: string;
}

interface KnowledgeNotesWorkspaceOptions {
  researchInterestId?: string;
  initialNotes?: KnowledgeNote[];
  initialInterests?: ResearchInterest[];
  onNotesChanged?: () => void | Promise<void>;
}

export function useKnowledgeNotesWorkspace({
  researchInterestId,
  initialNotes,
  initialInterests,
  onNotesChanged,
}: KnowledgeNotesWorkspaceOptions) {
  const [notes, setNotes] = useState<KnowledgeNote[]>(initialNotes ?? []);
  const [interests, setInterests] = useState<ResearchInterest[]>(initialInterests ?? []);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(!initialNotes);
  const [error, setError] = useState("");

  const syncGraphSnapshot = useCallback(() => {
    if (!onNotesChanged) return;
    void Promise.resolve(onNotesChanged()).catch((err) => { console.warn("syncGraphSnapshot failed:", err); });
  }, [onNotesChanged]);

  const setErrorFromUnknown = useCallback((nextError: unknown) => {
    const message = formatErrorMessage(nextError);
    setError(message);
    return new Error(message);
  }, []);

  const clearError = useCallback(() => setError(""), []);

  useEffect(() => {
    if (!initialInterests) return;
    setInterests(initialInterests);
  }, [initialInterests]);

  useEffect(() => {
    if (!initialNotes || debouncedSearch) return;
    setNotes(initialNotes);
    setLoading(false);
    setError("");
  }, [debouncedSearch, initialNotes]);

  useEffect(() => {
    if (initialInterests) return;

    let cancelled = false;
    apiClient.knowledge.listInterests()
      .then((data) => {
        if (!cancelled) {
          setInterests(data);
        }
      })
      .catch((err) => { console.warn("Failed to load interests:", err); });

    return () => {
      cancelled = true;
    };
  }, [initialInterests]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch && initialNotes) return;

    let cancelled = false;
    setLoading(true);

    apiClient.knowledge.listNotes(debouncedSearch || undefined)
      .then((data) => {
        if (!cancelled) {
          setNotes(data);
          setError("");
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatErrorMessage(nextError));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, initialNotes]);

  const interestMap = useMemo(
    () => Object.fromEntries(interests.map((item) => [item.id, item])),
    [interests],
  );

  const scopedNotes = useMemo(
    () => researchInterestId
      ? notes.filter((note) => note.research_interest_id === researchInterestId)
      : notes,
    [notes, researchInterestId],
  );

  const noteGroups = useMemo(() => {
    const visibleInterests = researchInterestId
      ? interests.filter((interest) => interest.id === researchInterestId)
      : interests;

    return visibleInterests.map((interest) => ({
      key: interest.id,
      title: interest.folder_name?.trim() || interest.topic,
      subtitle: interest.topic,
      notes: scopedNotes.filter((note) => note.research_interest_id === interest.id),
    }));
  }, [interests, researchInterestId, scopedNotes]);

  const ungroupedNotes = useMemo(() => {
    if (researchInterestId) return [];
    return notes.filter((note) => {
      if (!note.research_interest_id) return true;
      return !(note.research_interest_id in interestMap);
    });
  }, [interestMap, notes, researchInterestId]);

  const createNote = useCallback(async (draft: CreateKnowledgeNoteInput) => {
    try {
      clearError();
      const note = await apiClient.knowledge.createNote(draft);
      setNotes((prev) => [note, ...prev]);
      syncGraphSnapshot();
      void apiClient.memory.add({
        type: "auto",
        action: "note.create",
        summary: `创建了笔记：「${note.title}」`,
        detail: JSON.stringify({ note_id: note.id }),
      });
      return note;
    } catch (nextError) {
      throw setErrorFromUnknown(nextError);
    }
  }, [clearError, setErrorFromUnknown, syncGraphSnapshot]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      clearError();
      await apiClient.knowledge.deleteNote(id);
      setNotes((prev) => prev.filter((item) => item.id !== id));
      syncGraphSnapshot();
    } catch (nextError) {
      throw setErrorFromUnknown(nextError);
    }
  }, [clearError, setErrorFromUnknown, syncGraphSnapshot]);

  const saveNote = useCallback(async (id: string, draft: SaveKnowledgeNoteInput) => {
    try {
      clearError();
      const title = draft.title.trim();
      const content = draft.content.trim();
      await apiClient.knowledge.updateNote(id, { title, content });
      const moved = await apiClient.knowledge.moveNote(id, draft.research_interest_id || undefined);
      setNotes((prev) => prev.map((note) => (note.id === id ? moved : note)));
      syncGraphSnapshot();
      return moved;
    } catch (nextError) {
      throw setErrorFromUnknown(nextError);
    }
  }, [clearError, setErrorFromUnknown, syncGraphSnapshot]);

  const deleteInterestGroup = useCallback(async (interestId: string, deleteAll: boolean) => {
    try {
      clearError();
      if (deleteAll) {
        await apiClient.knowledge.deleteInterestBundle(interestId);
        setNotes((prev) => prev.filter((note) => note.research_interest_id !== interestId));
      } else {
        await apiClient.knowledge.deleteInterestOnly(interestId);
        setNotes((prev) => prev.map((note) => (
          note.research_interest_id === interestId
            ? { ...note, research_interest_id: undefined }
            : note
        )));
      }
      setInterests((prev) => prev.filter((interest) => interest.id !== interestId));
      syncGraphSnapshot();
    } catch (nextError) {
      throw setErrorFromUnknown(nextError);
    }
  }, [clearError, setErrorFromUnknown, syncGraphSnapshot]);

  const clipWebPage = useCallback(async (url: string, targetInterestId?: string) => {
    try {
      clearError();
      const note = await apiClient.knowledge.webClip(url, targetInterestId);
      setNotes((prev) => [note, ...prev]);
      syncGraphSnapshot();
      return note;
    } catch (nextError) {
      throw setErrorFromUnknown(nextError);
    }
  }, [clearError, setErrorFromUnknown, syncGraphSnapshot]);

  const importZip = useCallback(async (filePath: string, targetInterestId?: string) => {
    try {
      clearError();
      const result = await apiClient.knowledge.importZip(filePath, targetInterestId);
      const importedNotes = result.notes.map((item) => item.note);
      if (importedNotes.length > 0) {
        setNotes((prev) => [...importedNotes, ...prev]);
        syncGraphSnapshot();
      }
      return result;
    } catch (nextError) {
      throw setErrorFromUnknown(nextError);
    }
  }, [clearError, setErrorFromUnknown, syncGraphSnapshot]);

  return {
    notes,
    interests,
    search,
    setSearch,
    loading,
    error,
    clearError,
    interestMap,
    scopedNotes,
    noteGroups,
    ungroupedNotes,
    createNote,
    deleteNote,
    saveNote,
    deleteInterestGroup,
    clipWebPage,
    importZip,
  };
}
