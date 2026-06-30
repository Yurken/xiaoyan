"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { PaperNote, HighlightColor } from "@/lib/reader-types";
import { notesStorageKey } from "@/lib/reader-types";

export type SortMode = "page" | "created";

interface UseNotesOptions {
  paperId: string;
}

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  }
}

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") {
    return null;
  }

  const invoke = window.__TAURI_INTERNALS__?.invoke;
  return typeof invoke === "function" ? invoke : null;
}

// ── Backend adapter ──────────────────────────────────────────

interface NotesAdapter {
  list: (paperId: string) => Promise<PaperNote[]>;
  create: (data: {
    paper_id: string;
    page: number;
    content: string;
    highlight_text?: string;
    highlight_color?: HighlightColor;
    highlight_positions?: Array<{ x: number; y: number; w: number; h: number }>;
  }) => Promise<PaperNote>;
  update: (id: string, data: { content?: string; highlight_color?: HighlightColor }) => Promise<PaperNote>;
  delete: (id: string) => Promise<void>;
}

function createTauriAdapter(invoke: TauriInvoke): NotesAdapter {
  return {
    list: async (paperId) => {
      const rows = await invoke<PaperNote[]>("paper_notes_list", { paperId });
      return rows;
    },
    create: async (data) => {
      const note = await invoke<PaperNote>("paper_notes_create", {
        paperId: data.paper_id,
        page: data.page,
        content: data.content,
        highlightText: data.highlight_text ?? null,
        highlightColor: data.highlight_color ?? null,
        highlightPositions: data.highlight_positions ?? null,
      });
      return note;
    },
    update: async (id, data) => {
      const note = await invoke<PaperNote>("paper_notes_update", {
        id,
        content: data.content ?? null,
        highlightColor: data.highlight_color ?? null,
      });
      return note;
    },
    delete: async (id) => {
      await invoke<void>("paper_notes_delete", { id });
    },
  };
}

/** localStorage fallback adapter */
function localStorageAdapter(paperId: string): NotesAdapter {
  const key = notesStorageKey(paperId);

  function load(): PaperNote[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function save(notes: PaperNote[]) {
    try {
      localStorage.setItem(key, JSON.stringify(notes));
    } catch {
      // quota exceeded
    }
  }

  return {
    list: async () => load(),
    create: async (data) => {
      const now = new Date().toISOString();
      const note: PaperNote = {
        id: crypto.randomUUID(),
        paper_id: data.paper_id,
        page: data.page,
        content: data.content,
        highlight_text: data.highlight_text,
        highlight_color: data.highlight_color ?? "yellow",
        highlight_positions: data.highlight_positions,
        created_at: now,
        updated_at: now,
      };
      const notes = [...load(), note];
      save(notes);
      return note;
    },
    update: async (id, data) => {
      let updatedNote: PaperNote | null = null;
      const notes = load().map((n) => {
        if (n.id !== id) return n;
        updatedNote = { ...n, ...data, updated_at: new Date().toISOString() };
        return updatedNote;
      });
      if (!updatedNote) {
        throw new Error(`Note ${id} was not found`);
      }
      save(notes);
      return updatedNote;
    },
    delete: async (id) => {
      const notes = load().filter((n) => n.id !== id);
      save(notes);
    },
  };
}

// ── Hook ─────────────────────────────────────────────────────

export function useNotes({ paperId }: UseNotesOptions) {
  const [notes, setNotes] = useState<PaperNote[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("page");
  const [searchQuery, setSearchQuery] = useState("");
  const adapterRef = useRef<NotesAdapter | null>(null);

  // Initialize adapter
  useEffect(() => {
    let cancelled = false;
    const tauriInvoke = getTauriInvoke();
    const adapter = tauriInvoke ? createTauriAdapter(tauriInvoke) : localStorageAdapter(paperId);
    adapterRef.current = adapter;

    // Load initial data
    adapter.list(paperId).then((nextNotes) => {
      if (!cancelled && adapterRef.current === adapter) {
        setNotes(nextNotes);
      }
    }).catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [paperId]);

  const addNote = useCallback(
    (data: {
      page: number;
      content: string;
      highlight_text?: string;
      highlight_color?: HighlightColor;
      highlight_positions?: Array<{ x: number; y: number; w: number; h: number }>;
    }) => {
      const adapter = adapterRef.current;
      if (!adapter) return null;

      const fullData = { ...data, paper_id: paperId };
      // Optimistic local update
      const now = new Date().toISOString();
      const optimistic: PaperNote = {
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
      setNotes((prev) => [...prev, optimistic]);

      adapter.create(fullData).then((real) => {
        setNotes((prev) => prev.map((n) => (n.id === optimistic.id ? real : n)));
      }).catch(() => {
        // keep optimistic note
      });

      return optimistic;
    },
    [paperId],
  );

  const updateNote = useCallback(
    (id: string, data: { content?: string; highlight_color?: HighlightColor }) => {
      const adapter = adapterRef.current;
      if (!adapter) return;

      // Optimistic local update
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...data, updated_at: new Date().toISOString() } : n,
        ),
      );

      adapter.update(id, data).then((real) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? real : n)));
      }).catch(console.error);
    },
    [],
  );

  const deleteNote = useCallback(
    (id: string) => {
      const adapter = adapterRef.current;
      if (!adapter) return;

      // Optimistic local update
      setNotes((prev) => prev.filter((n) => n.id !== id));

      adapter.delete(id).catch(console.error);
    },
    [],
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
    setNotes([]);
    // For localStorage adapter, clear storage
    if (!getTauriInvoke()) {
      try {
        localStorage.removeItem(notesStorageKey(paperId));
      } catch {
        // ignore
      }
    }
  }, [paperId]);

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
