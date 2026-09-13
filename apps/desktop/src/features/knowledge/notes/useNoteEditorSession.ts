import { useCallback, useEffect, useRef, useState } from "react";
import type { KnowledgeNote } from "@research-copilot/types";
import { deriveNoteTitle, type NoteDraft, type NoteSaveState } from "./shared";

interface StoredDraft extends NoteDraft {
  baseUpdatedAt?: string;
}

interface NoteEditorSessionOptions {
  note: KnowledgeNote | null;
  creating: boolean;
  defaultInterestId?: string;
  onCreate: (draft: NoteDraft) => Promise<KnowledgeNote>;
  onSave: (id: string, draft: NoteDraft) => Promise<KnowledgeNote>;
  onCreated: (note: KnowledgeNote) => void;
}

function draftKey(note: KnowledgeNote | null, creating: boolean) {
  return `rc:knowledge:note-draft:${creating ? "new" : note?.id ?? "none"}`;
}

function readStoredDraft(key: string, note: KnowledgeNote | null): NoteDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDraft;
    if (note && stored.baseUpdatedAt && stored.baseUpdatedAt < note.updated_at) return null;
    if (typeof stored.title !== "string" || typeof stored.content !== "string") return null;
    return {
      title: stored.title,
      content: stored.content,
      research_interest_id: stored.research_interest_id ?? "",
    };
  } catch {
    return null;
  }
}

export function useNoteEditorSession({
  note,
  creating,
  defaultInterestId,
  onCreate,
  onSave,
  onCreated,
}: NoteEditorSessionOptions) {
  const key = draftKey(note, creating);
  const buildInitialDraft = (): NoteDraft => ({
    title: creating ? "" : note?.title ?? "",
    content: creating ? "" : note?.content ?? "",
    research_interest_id: creating
      ? defaultInterestId ?? ""
      : note?.research_interest_id ?? "",
  });
  const restoredOnMount = readStoredDraft(key, note);
  const [draft, setDraft] = useState<NoteDraft>(() => restoredOnMount ?? buildInitialDraft());
  const [dirty, setDirty] = useState(Boolean(restoredOnMount));
  const [saveState, setSaveState] = useState<NoteSaveState>(dirty ? "draft" : "clean");
  const [saveError, setSaveError] = useState("");
  const latestDraft = useRef(draft);
  const editSequence = useRef(0);
  const saving = useRef(false);
  const pendingSave = useRef(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const restored = readStoredDraft(key, note);
    setDraft(restored ?? buildInitialDraft());
    latestDraft.current = restored ?? buildInitialDraft();
    setDirty(Boolean(restored));
    setSaveState(restored ? "draft" : "clean");
    setSaveError("");
    editSequence.current = 0;
    // The key changes only when the selected note or create session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const updateDraft = useCallback((update: Partial<NoteDraft>) => {
    editSequence.current += 1;
    setDraft((current) => {
      const next = { ...current, ...update };
      latestDraft.current = next;
      return next;
    });
    setDirty(true);
    setSaveState("draft");
    setSaveError("");
  }, []);

  useEffect(() => {
    if (!dirty) return;
    try {
      const stored: StoredDraft = { ...draft, baseUpdatedAt: note?.updated_at };
      window.localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // The database save remains available when local draft storage is unavailable.
    }
  }, [dirty, draft, key, note?.updated_at]);

  const saveNow = useCallback(async () => {
    if (!dirty) return;
    if (saving.current) {
      pendingSave.current = true;
      return;
    }
    if (!draft.title.trim() && !draft.content.trim()) return;

    saving.current = true;
    setSaveState("saving");
    const submittedSequence = editSequence.current;
    const submittedDraft = {
      ...draft,
      title: draft.title.trim() || deriveNoteTitle(draft.content),
    };

    try {
      const saved = creating
        ? await onCreate(submittedDraft)
        : note
          ? await onSave(note.id, submittedDraft)
          : null;
      if (!saved) return;

      if (submittedSequence === editSequence.current) {
        const nextDraft = {
          title: saved.title,
          content: saved.content,
          research_interest_id: saved.research_interest_id ?? "",
        };
        latestDraft.current = nextDraft;
        setDraft(nextDraft);
        setDirty(false);
        setSaveState("saved");
        try { window.localStorage.removeItem(key); } catch { /* noop */ }
      } else {
        setSaveState("draft");
        if (creating) {
          const savedKey = draftKey(saved, false);
          try {
            const stored: StoredDraft = {
              ...latestDraft.current,
              baseUpdatedAt: saved.updated_at,
            };
            window.localStorage.setItem(savedKey, JSON.stringify(stored));
          } catch {
            // The pending save still retries after the create session becomes a saved note.
          }
        }
      }
      if (creating) onCreated(saved);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      saving.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        setRetryToken((value) => value + 1);
      }
    }
  }, [creating, dirty, draft, key, note, onCreate, onCreated, onSave]);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void saveNow(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, retryToken, saveNow]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  return { draft, updateDraft, dirty, saveState, saveError, saveNow };
}
