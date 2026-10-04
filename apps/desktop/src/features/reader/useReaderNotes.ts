import { useCallback, useEffect } from "react";
import { paperNotesApi } from "../../lib/client";
import { normalizePaperNote, type HighlightColor, type NormalizedRect, type PaperNote } from "./readerTypes";
import {
  annotationUpdatePayload, hasAnnotationChanges, MAX_READER_NOTE_UNDO, previousAnnotationPatch, remapReaderNoteUndoIds,
  type AnnotationPatch, type CreateAnnotationInput, type ReaderNoteUndoEntry,
} from "./notes/shared";
import { useReaderNotesSession } from "./notes/useReaderNotesSession";

export function useReaderNotes(paperId: string | undefined) {
  const { session, run } = useReaderNotesSession(paperId);

  const pushUndo = useCallback((entry: ReaderNoteUndoEntry) => {
    session.undo.push(entry);
    if (session.undo.length > MAX_READER_NOTE_UNDO) session.undo.shift();
  }, [session]);

  const reload = useCallback(() => run(async () => {
    if (!session.paperId) return;
    session.loading = true;
    session.notify?.();
    try {
      const rows = await paperNotesApi.list(session.paperId);
      session.notes = (Array.isArray(rows) ? rows : [])
        .map(normalizePaperNote)
        .filter((note): note is PaperNote => note !== null && note.paper_id === session.paperId);
    } finally {
      session.loading = false;
    }
  }, "加载批注失败"), [run, session]);

  useEffect(() => { void reload(); }, [reload]);

  const createAnnotation = useCallback((input: CreateAnnotationInput) => run(async () => {
    if (!session.paperId) return;
    const created = await paperNotesApi.create({
      paper_id: session.paperId, page: input.page, content: input.content ?? "",
      highlight_text: input.highlightText, highlight_color: input.color,
      highlight_positions: input.positions, style: input.style, fill_color: input.fillColor ?? "none",
    });
    const note = normalizePaperNote(created);
    if (!note || note.paper_id !== session.paperId) throw new Error("保存批注返回了无效记录，请重新加载批注。");
    session.notes = [...session.notes, note];
    pushUndo({ kind: "remove", id: note.id });
  }, "保存批注失败"), [pushUndo, run, session]);

  const patchAnnotation = useCallback((id: string, patch: AnnotationPatch, failureMessage: string) => run(async () => {
    const previous = session.notes.find((note) => note.id === id);
    if (!previous) throw new Error("未找到对应批注，请重新加载批注。");
    if (!hasAnnotationChanges(previous, patch)) return;
    const updated = await paperNotesApi.update(id, annotationUpdatePayload(patch));
    const saved = normalizePaperNote(updated);
    session.notes = session.notes.map((note) => note.id === id
      ? saved && saved.id === id && saved.paper_id === session.paperId ? saved : { ...note, ...patch }
      : note);
    pushUndo({ kind: "update", id, patch: previousAnnotationPatch(previous, patch) });
  }, failureMessage), [pushUndo, run, session]);

  const updateColor = useCallback((id: string, color: HighlightColor) =>
    patchAnnotation(id, { highlight_color: color }, "更新批注失败"), [patchAnnotation]);
  const updateContent = useCallback((id: string, content: string) =>
    patchAnnotation(id, { content }, "更新笔记失败"), [patchAnnotation]);
  const updateFill = useCallback((id: string, fill: HighlightColor | null) =>
    patchAnnotation(id, { fill_color: fill }, "更新批注失败"), [patchAnnotation]);
  const moveAnnotation = useCallback((id: string, positions: NormalizedRect[]) =>
    patchAnnotation(id, { highlight_positions: positions }, "移动批注失败"), [patchAnnotation]);

  const deleteAnnotation = useCallback((id: string) => run(async () => {
    const removed = session.notes.find((note) => note.id === id);
    if (!removed) throw new Error("未找到对应批注，请重新加载批注。");
    await paperNotesApi.delete(id);
    session.notes = session.notes.filter((note) => note.id !== id);
    pushUndo({ kind: "restore", note: removed });
  }, "删除批注失败"), [pushUndo, run, session]);

  // 只有逆操作落库成功才消费撤销项；失败时保留记录与历史供重试。
  const undo = useCallback(() => run(async () => {
    const entry = session.undo.at(-1);
    if (!entry) return;
    if (entry.kind === "remove") {
      await paperNotesApi.delete(entry.id);
      session.notes = session.notes.filter((note) => note.id !== entry.id);
    } else if (entry.kind === "update") {
      const updated = await paperNotesApi.update(entry.id, annotationUpdatePayload(entry.patch));
      const saved = normalizePaperNote(updated);
      session.notes = session.notes.map((note) => note.id === entry.id
        ? saved && saved.id === entry.id && saved.paper_id === session.paperId ? saved : { ...note, ...entry.patch }
        : note);
    } else {
      const { note } = entry;
      const created = await paperNotesApi.create({
        paper_id: note.paper_id, page: note.page, content: note.content,
        highlight_text: note.highlight_text ?? undefined, highlight_color: note.highlight_color,
        highlight_positions: note.highlight_positions ?? undefined, style: note.style,
        fill_color: note.fill_color ?? "none",
      });
      const restored = normalizePaperNote(created);
      if (!restored || restored.paper_id !== session.paperId) throw new Error("恢复批注返回了无效记录，请重新加载批注。");
      session.notes = [...session.notes, restored];
      session.undo = remapReaderNoteUndoIds(session.undo, note.id, restored.id);
    }
    session.undo.pop();
  }, "撤销失败"), [run, session]);

  return {
    notes: session.notes, loading: session.loading, error: session.error, reload,
    createAnnotation, updateColor, updateFill, updateContent, moveAnnotation, deleteAnnotation, undo,
  };
}
