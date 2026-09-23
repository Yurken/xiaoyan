import { useCallback, useEffect, useMemo, useState } from "react";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface CreateKnowledgeNoteInput {
  title: string;
  content: string;
  tags?: string[];
  research_interest_id?: string;
  source_type?: string;
  source_id?: string;
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

  const acceptCreatedNote = useCallback((note: KnowledgeNote) => {
    // A create request may have started in a previous workspace mount.
    setNotes((current) => current.some((item) => item.id === note.id) ? current : [note, ...current]);
  }, []);

  useEffect(() => {
    if (!initialInterests) return;
    setInterests(initialInterests);
  }, [initialInterests]);

  useEffect(() => {
    if (!initialNotes) return;
    setNotes(initialNotes);
    setLoading(false);
    setError("");
  }, [initialNotes]);

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
    if (initialNotes) return;

    let cancelled = false;
    setLoading(true);

    apiClient.knowledge.listNotes()
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
  }, [initialNotes]);

  const interestMap = useMemo(
    () => Object.fromEntries(interests.map((item) => [item.id, item])),
    [interests],
  );

  const scopedNotes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return notes.filter((note) => {
      if (researchInterestId && note.research_interest_id !== researchInterestId) return false;
      if (!normalizedSearch) return true;
      return [note.title, note.content, ...(note.tags ?? [])]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [notes, researchInterestId, search]);

  const createNote = useCallback(async (draft: CreateKnowledgeNoteInput) => {
    try {
      clearError();
      const note = await apiClient.knowledge.createNote(draft);
      const sourceType = draft.source_type || note.source_type || "manual";
      const enriched: KnowledgeNote = { ...note, source_type: sourceType };
      setNotes((prev) => [enriched, ...prev]);
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
      const content = draft.content;
      const saved = await apiClient.knowledge.updateNote(id, {
        title,
        content,
        research_interest_id: draft.research_interest_id,
      });
      setNotes((prev) => prev.map((note) => (note.id === id ? saved : note)));
      syncGraphSnapshot();
      return saved;
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
    createNote,
    acceptCreatedNote,
    deleteNote,
    saveNote,
    clipWebPage,
    importZip,
  };
}
