"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { PaperNote, HighlightColor } from "@/lib/reader-types";
import { notesStorageKey } from "@/lib/reader-types";

export type SortMode = "page" | "created";

interface UseNotesOptions {
  paperId: string;
}

export function useNotes({ paperId }: UseNotesOptions) {
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("page");
  const [searchQuery, setSearchQuery] = useState("");
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Load notes from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(notesStorageKey(paperId));
      if (raw) setNotes(JSON.parse(raw));
    } catch {
      // ignore parse errors
    }
  }, [paperId]);

  // Persist helper — uses ref to avoid stale closures
  const persistNext = useCallback(
    (updater: (prev: PaperNote[]) => PaperNote[]) => {
      setNotes((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(notesStorageKey(paperId), JSON.stringify(next));
        } catch {
          // quota exceeded etc.
        }
        return next;
      });
    },
    [paperId],
  );

  const addNote = useCallback(
    (data: {
      page: number;
      content: string;
      highlight_text?: string;
      highlight_color?: HighlightColor;
      highlight_positions?: Array<{ x: number; y: number; w: number; h: number }>;
    }) => {
      const now = new Date().toISOString();
      const note: PaperNote = {
        id: crypto.randomUUID(),
        paper_id: paperId,
        page: data.page,
        content: data.content,
        highlight_text: data.highlight_text,
        highlight_color: data.highlight_color ?? "yellow",
        highlight_positions: data.highlight_positions,
        created_at: now,
        updated_at: now,
      };
      persistNext((prev) => [...prev, note]);
      return note;
    },
    [paperId, persistNext],
  );

  const updateNote = useCallback(
    (id: string, data: { content?: string; highlight_color?: HighlightColor }) => {
      persistNext((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...data, updated_at: new Date().toISOString() } : n,
        ),
      );
    },
    [persistNext],
  );

  const deleteNote = useCallback(
    (id: string) => {
      persistNext((prev) => prev.filter((n) => n.id !== id));
    },
    [persistNext],
  );

  // Filtered + sorted notes
  const filteredNotes = useMemo(() => {
    let result = notes;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.content.toLowerCase().includes(q) ||
          (n.highlight_text ?? "").toLowerCase().includes(q),
      );
    }

    return [...result].sort((a, b) => {
      if (sortMode === "page") return a.page - b.page || a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [notes, searchQuery, sortMode]);

  const notesByPage = useMemo(() => {
    const map = new Map<number, PaperNote[]>();
    for (const n of filteredNotes) {
      const list = map.get(n.page) ?? [];
      list.push(n);
      map.set(n.page, list);
    }
    return map;
  }, [filteredNotes]);

  const clearAll = useCallback(() => {
    persistNext(() => []);
  }, [persistNext]);

  return {
    notes: filteredNotes,
    allNotes: notes,
    notesByPage,
    totalCount: notes.length,
    addNote,
    updateNote,
    deleteNote,
    clearAll,
    sortMode,
    setSortMode,
    searchQuery,
    setSearchQuery,
  };
}
