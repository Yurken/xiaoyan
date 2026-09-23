import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { KnowledgeNote } from "@research-copilot/types";
import {
  deriveNoteTitle, noteDraftKey, noteToDraft,
  type NoteDraft, type NoteSaveState,
} from "./shared";
import {
  getNoteDraftCleanupKey, linkNoteDraftCleanup, ownsNoteDraft,
  readNoteDraft, removeNoteDraft, writeNoteDraft,
} from "./noteDraftStorage";

interface NoteEditorSessionOptions {
  note: KnowledgeNote | null;
  creating: boolean;
  defaultInterestId?: string;
  onCreate: (draft: NoteDraft) => Promise<KnowledgeNote>;
  onSave: (id: string, draft: NoteDraft) => Promise<KnowledgeNote>;
  onCreated: (note: KnowledgeNote) => void;
}

function createSession(key: string, note: KnowledgeNote | null, defaultInterestId?: string) {
  const pending = savingSessions.get(key);
  if (pending) return pending;
  return buildSession(key, note, defaultInterestId);
}

function buildSession(key: string, note: KnowledgeNote | null, defaultInterestId?: string) {
  const { draft: stored, persisted } = readNoteDraft(key);
  const conflict = Boolean(stored?.baseUpdatedAt && note && stored.baseUpdatedAt !== note.updated_at);
  return {
    key, note, token: crypto.randomUUID(),
    notify: null as (() => void) | null,
    onCreated: null as ((saved: KnowledgeNote) => void) | null,
    draft: stored ? {
      title: stored.title,
      content: stored.content,
      research_interest_id: stored.research_interest_id ?? "",
    } : noteToDraft(note, defaultInterestId),
    baseUpdatedAt: stored?.baseUpdatedAt ?? note?.updated_at,
    dirty: Boolean(stored), persisted, conflict,
    saveState: (conflict ? "conflict" : stored ? "draft" : "clean") as NoteSaveState,
    saveError: "", sequence: 0, saving: false,
    cleanupKey: getNoteDraftCleanupKey(key),
    refreshDuringSave: null as KnowledgeNote | null,
  };
}

type EditorSession = ReturnType<typeof buildSession>;
// Keep one request per draft alive across selection changes within this window.
const savingSessions = new Map<string, EditorSession>();

function persistSession(session: EditorSession) {
  session.persisted = writeNoteDraft(session.key, {
    ...session.draft, baseUpdatedAt: session.baseUpdatedAt, token: session.token,
  });
  // A fresh edit replaces the abandoned draft; a later cleanup must not erase it.
  if (session.cleanupKey === session.key) session.cleanupKey = null;
}

function cleanupDraft(session: EditorSession, key: string) {
  session.cleanupKey = removeNoteDraft(key, session.token) ? null : key;
  if (session.cleanupKey) linkNoteDraftCleanup(session.key, key);
}

export function useNoteEditorSession({
  note, creating, defaultInterestId, onCreate, onSave, onCreated,
}: NoteEditorSessionOptions) {
  const key = noteDraftKey(note, creating, defaultInterestId);
  // A response owns the object it started with, even after another document is selected.
  const session = useMemo(
    () => createSession(key, creating ? null : note, defaultInterestId),
    // Same-document refreshes are reconciled below without replacing dirty content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const current = useRef(session);
  current.current = session;
  const createdCallback = useRef(onCreated);
  createdCallback.current = onCreated;
  const [revision, render] = useReducer((value: number) => value + 1, 0);
  const publish = useCallback(() => {
    session.notify?.();
  }, [session]);

  useEffect(() => {
    const notify = () => { if (current.current === session) render(); };
    session.notify = notify;
    session.onCreated = (saved) => {
      if (current.current === session) createdCallback.current(saved);
    };
    if (session.dirty) persistSession(session);
    publish();
    return () => {
      if (session.notify === notify) {
        session.notify = null;
        session.onCreated = null;
      }
    };
  }, [publish, session]);

  useEffect(() => {
    if (!note || creating) return;
    if (session.saving) {
      if (session.note && Date.parse(note.updated_at) > Date.parse(session.note.updated_at)) {
        session.refreshDuringSave = note;
      }
      return;
    }
    const deferredRefresh = session.refreshDuringSave;
    session.refreshDuringSave = null;
    const refreshedNote = deferredRefresh && Date.parse(deferredRefresh.updated_at) > Date.parse(note.updated_at)
      ? deferredRefresh : note;
    if (session.note?.updated_at === refreshedNote.updated_at) return;
    if (session.note && Date.parse(refreshedNote.updated_at) < Date.parse(session.note.updated_at)) return;
    session.note = refreshedNote;
    if (session.dirty || deferredRefresh?.updated_at === refreshedNote.updated_at) {
      session.dirty = true;
      session.conflict = true;
      session.saveState = "conflict";
      persistSession(session);
    } else {
      session.draft = noteToDraft(refreshedNote);
      session.baseUpdatedAt = refreshedNote.updated_at;
      session.saveState = "clean";
    }
    publish();
  }, [creating, note, publish, revision, session]);

  const updateDraft = useCallback((update: Partial<NoteDraft>) => {
    session.sequence += 1;
    session.draft = { ...session.draft, ...update };
    session.dirty = true;
    session.saveState = session.saving ? "saving" : session.conflict ? "conflict" : "draft";
    session.saveError = "";
    persistSession(session);
    publish();
  }, [publish, session]);

  const save = useCallback(async (asCopy = false) => {
    if (!session.dirty || session.saving || (session.conflict && !asCopy)) return;
    if (!session.note && !session.draft.title.trim() && !session.draft.content.trim()) return;

    session.saving = true;
    session.saveState = "saving";
    session.saveError = "";
    publish();
    const submittedSequence = session.sequence;
    const sourceKey = session.key;
    savingSessions.set(sourceKey, session);
    const originalNote = session.note;
    const isCreation = !originalNote || asCopy;
    const submittedDraft = {
      ...session.draft,
      title: session.draft.title.trim() || deriveNoteTitle(session.draft.content),
    };

    try {
      const saved = originalNote && !asCopy
        ? await onSave(originalNote.id, submittedDraft)
        : await onCreate(submittedDraft);
      // Another editor may have taken over the stored draft while this request ran.
      const ownsDraft = ownsNoteDraft(sourceKey, session.token);
      session.note = saved;
      session.baseUpdatedAt = saved.updated_at;
      session.conflict = false;
      session.key = noteDraftKey(saved, false);
      if (submittedSequence === session.sequence) {
        session.draft = noteToDraft(saved);
        session.dirty = false;
        session.saveState = "saved";
        if (ownsDraft) cleanupDraft(session, sourceKey);
      } else {
        session.saveState = "draft";
        if (ownsDraft) {
          // Rebase the remaining edits before a remount can see the new database version.
          persistSession(session);
          if (sourceKey !== session.key) cleanupDraft(session, sourceKey);
        }
      }
      if (isCreation) session.onCreated?.(saved);
    } catch (error) {
      session.saveState = session.conflict ? "conflict" : "error";
      session.saveError = error instanceof Error ? error.message : String(error);
    } finally {
      session.saving = false;
      if (savingSessions.get(sourceKey) === session) savingSessions.delete(sourceKey);
      publish();
    }
  }, [onCreate, onSave, publish, session]);

  const saveNow = useCallback(() => save(), [save]);
  const saveAsCopy = useCallback(() => save(true), [save]);

  const discardDraft = useCallback(() => {
    if (session.saving) return;
    cleanupDraft(session, session.key);
    session.draft = noteToDraft(session.note, defaultInterestId);
    session.baseUpdatedAt = session.note?.updated_at;
    session.dirty = false;
    session.conflict = false;
    session.saveState = "clean";
    session.saveError = "";
    publish();
  }, [defaultInterestId, publish, session]);

  const retryDraftPersistence = useCallback(() => {
    if (session.dirty) persistSession(session);
    if (session.cleanupKey) cleanupDraft(session, session.cleanupKey);
    publish();
  }, [publish, session]);

  useEffect(() => {
    if (!session.dirty || session.saving || session.conflict || session.saveState === "error") return;
    const timer = window.setTimeout(() => void saveNow(), 900);
    return () => window.clearTimeout(timer);
  }, [revision, saveNow, session]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (session.dirty && !session.persisted) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [saveNow, session]);

  return {
    draft: session.draft, updateDraft, dirty: session.dirty,
    saveState: session.saveState, saveError: session.saveError,
    draftPersisted: session.persisted,
    persistenceError: session.dirty && !session.persisted
      ? "本机草稿写入失败，修改暂留在当前窗口。关闭应用前请重试或保存笔记。"
      : session.cleanupKey ? "本机草稿清理失败，当前窗口已忽略旧草稿。请重试，避免重启后再次恢复。" : "",
    conflictingNote: session.conflict ? session.note : null,
    saveNow, saveAsCopy, discardDraft, retryDraftPersistence,
  };
}
