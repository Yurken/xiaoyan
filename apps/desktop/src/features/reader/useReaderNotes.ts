import { useCallback, useEffect, useState } from "react";
import { paperNotesApi } from "../../lib/client";
import {
  normalizePaperNote,
  type AnnotationStyle,
  type HighlightColor,
  type NormalizedRect,
  type PaperNote,
} from "./readerTypes";

interface CreateAnnotationInput {
  page: number;
  highlightText: string;
  color: HighlightColor;
  style: AnnotationStyle;
  positions: NormalizedRect[];
  content?: string;
}

export function useReaderNotes(paperId: string | undefined) {
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!paperId) return;
    setLoading(true);
    try {
      const rows = await paperNotesApi.list(paperId);
      const list = (Array.isArray(rows) ? rows : [])
        .map(normalizePaperNote)
        .filter((note): note is PaperNote => note !== null);
      setNotes(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载批注失败");
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createAnnotation = useCallback(
    async (input: CreateAnnotationInput) => {
      if (!paperId) return;
      try {
        const created = await paperNotesApi.create({
          paper_id: paperId,
          page: input.page,
          content: input.content ?? "",
          highlight_text: input.highlightText,
          highlight_color: input.color,
          highlight_positions: input.positions,
          style: input.style,
        });
        const note = normalizePaperNote(created);
        if (note) {
          setNotes((current) => [...current, note]);
        } else {
          await reload();
        }
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存批注失败");
      }
    },
    [paperId, reload],
  );

  const updateColor = useCallback(async (id: string, color: HighlightColor) => {
    setNotes((current) => current.map((note) => (note.id === id ? { ...note, highlight_color: color } : note)));
    try {
      await paperNotesApi.update(id, { highlight_color: color });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新批注失败");
    }
  }, []);

  const deleteAnnotation = useCallback(async (id: string) => {
    const snapshot = notes;
    setNotes((current) => current.filter((note) => note.id !== id));
    try {
      await paperNotesApi.delete(id);
    } catch (err) {
      setNotes(snapshot);
      setError(err instanceof Error ? err.message : "删除批注失败");
    }
  }, [notes]);

  return { notes, loading, error, reload, createAnnotation, updateColor, deleteAnnotation };
}
