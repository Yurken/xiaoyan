import { useCallback, useEffect, useRef, useState } from "react";
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
  /** 形状填充色；null/缺省 = 不填充。 */
  fillColor?: HighlightColor | null;
}

/** 撤销栈条目：记录某次批注操作的“逆操作”。 */
type UndoEntry =
  | { kind: "remove"; id: string } // 撤销“创建” → 删除该批注
  | { kind: "restore"; note: PaperNote } // 撤销“删除” → 重新创建
  | { kind: "recolor"; id: string; color: HighlightColor } // 撤销“改色” → 还原边框色
  | { kind: "refill"; id: string; fill: HighlightColor | null } // 撤销“改填充” → 还原填充
  | { kind: "reposition"; id: string; positions: NormalizedRect[] } // 撤销“移动” → 还原位置
  | { kind: "recontent"; id: string; content: string }; // 撤销“改笔记” → 还原笔记内容

const MAX_UNDO = 100;

export function useReaderNotes(paperId: string | undefined) {
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 让各操作能同步读到最新 notes（用于捕获“删除前的批注 / 改色前的颜色”），避免把 notes 塞进依赖。
  const notesRef = useRef<PaperNote[]>([]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const undoRef = useRef<UndoEntry[]>([]);
  const pushUndo = useCallback((entry: UndoEntry) => {
    const stack = undoRef.current;
    stack.push(entry);
    if (stack.length > MAX_UNDO) stack.shift();
  }, []);

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
    undoRef.current = []; // 切换论文时清空撤销栈
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
          fill_color: input.fillColor ?? "none",
        });
        const note = normalizePaperNote(created);
        if (note) {
          setNotes((current) => [...current, note]);
          pushUndo({ kind: "remove", id: note.id });
        } else {
          await reload();
        }
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存批注失败");
      }
    },
    [paperId, reload, pushUndo],
  );

  const updateColor = useCallback(
    async (id: string, color: HighlightColor) => {
      const prev = notesRef.current.find((note) => note.id === id)?.highlight_color;
      if (prev && prev !== color) pushUndo({ kind: "recolor", id, color: prev });
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, highlight_color: color } : note)));
      try {
        await paperNotesApi.update(id, { highlight_color: color });
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新批注失败");
      }
    },
    [pushUndo],
  );

  const updateContent = useCallback(
    async (id: string, content: string) => {
      const prev = notesRef.current.find((note) => note.id === id)?.content;
      if (prev !== content) pushUndo({ kind: "recontent", id, content: prev ?? "" });
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, content } : note)));
      try {
        await paperNotesApi.update(id, { content });
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新笔记失败");
      }
    },
    [pushUndo],
  );

  const updateFill = useCallback(
    async (id: string, fill: HighlightColor | null) => {
      const prev = notesRef.current.find((note) => note.id === id)?.fill_color ?? null;
      if (prev !== fill) pushUndo({ kind: "refill", id, fill: prev });
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, fill_color: fill } : note)));
      try {
        await paperNotesApi.update(id, { fill_color: fill ?? "none" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新批注失败");
      }
    },
    [pushUndo],
  );

  const moveAnnotation = useCallback(
    async (id: string, positions: NormalizedRect[]) => {
      const prev = notesRef.current.find((note) => note.id === id)?.highlight_positions;
      if (prev && prev.length) pushUndo({ kind: "reposition", id, positions: prev });
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, highlight_positions: positions } : note)));
      try {
        await paperNotesApi.update(id, { highlight_positions: positions });
      } catch (err) {
        setError(err instanceof Error ? err.message : "移动批注失败");
      }
    },
    [pushUndo],
  );

  const deleteAnnotation = useCallback(
    async (id: string) => {
      const snapshot = notesRef.current;
      const removed = snapshot.find((note) => note.id === id);
      setNotes((current) => current.filter((note) => note.id !== id));
      if (removed) pushUndo({ kind: "restore", note: removed });
      try {
        await paperNotesApi.delete(id);
      } catch (err) {
        setNotes(snapshot);
        setError(err instanceof Error ? err.message : "删除批注失败");
      }
    },
    [pushUndo],
  );

  // 撤销最近一次批注操作（创建/删除/改色）。逆操作直接走底层 API，不再压栈。
  const undo = useCallback(async () => {
    const entry = undoRef.current.pop();
    if (!entry) return;
    try {
      if (entry.kind === "remove") {
        setNotes((current) => current.filter((note) => note.id !== entry.id));
        await paperNotesApi.delete(entry.id);
      } else if (entry.kind === "recolor") {
        setNotes((current) =>
          current.map((note) => (note.id === entry.id ? { ...note, highlight_color: entry.color } : note)),
        );
        await paperNotesApi.update(entry.id, { highlight_color: entry.color });
      } else if (entry.kind === "refill") {
        setNotes((current) =>
          current.map((note) => (note.id === entry.id ? { ...note, fill_color: entry.fill } : note)),
        );
        await paperNotesApi.update(entry.id, { fill_color: entry.fill ?? "none" });
      } else if (entry.kind === "reposition") {
        setNotes((current) =>
          current.map((note) => (note.id === entry.id ? { ...note, highlight_positions: entry.positions } : note)),
        );
        await paperNotesApi.update(entry.id, { highlight_positions: entry.positions });
      } else if (entry.kind === "recontent") {
        setNotes((current) =>
          current.map((note) => (note.id === entry.id ? { ...note, content: entry.content } : note)),
        );
        await paperNotesApi.update(entry.id, { content: entry.content });
      } else {
        const { note } = entry;
        const created = await paperNotesApi.create({
          paper_id: note.paper_id,
          page: note.page,
          content: note.content,
          highlight_text: note.highlight_text ?? undefined,
          highlight_color: note.highlight_color,
          highlight_positions: note.highlight_positions ?? undefined,
          style: note.style,
          fill_color: note.fill_color ?? "none",
        });
        const restored = normalizePaperNote(created);
        if (restored) setNotes((current) => [...current, restored]);
        else await reload();
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销失败");
    }
  }, [reload]);

  return { notes, loading, error, reload, createAnnotation, updateColor, updateFill, updateContent, moveAnnotation, deleteAnnotation, undo };
}
