import { useCallback, useEffect, useRef, useState } from "react";
import type { KnowledgeNote } from "@research-copilot/types";
import { getRecords } from "../sync/localStore";

const LOCAL_READ_FAILED = "无法读取本地知识库，请重新同步后再试";

function matchesSearch(note: KnowledgeNote, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  return (
    note.title.toLowerCase().includes(needle) ||
    note.content.toLowerCase().includes(needle)
  );
}

export function useKnowledgeNotes() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet && mountedRef.current) {
      setLoading(true);
    }

    try {
      const records = await getRecords<KnowledgeNote>("knowledge_notes");
      const keyword = search.trim();
      const filtered = keyword
        ? records.filter((note) => matchesSearch(note, keyword))
        : records;
      if (!mountedRef.current) return;
      setNotes(filtered);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setNotes([]);
      setError(LOCAL_READ_FAILED);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    if (mountedRef.current) {
      setRefreshing(true);
    }
    await load(true);
  }, [load]);

  return {
    notes,
    search,
    setSearch,
    loading,
    refreshing,
    error,
    refresh,
  };
}
