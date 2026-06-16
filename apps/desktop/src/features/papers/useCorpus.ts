import { useCallback, useEffect, useState } from "react";
import { paperCorpusApi } from "../../lib/client";
import { normalizeCorpusEntry, type CorpusEntry } from "./corpusTypes";

interface CreateCorpusInput {
  paperId?: string;
  text: string;
  note?: string;
  page?: number;
  tags?: string[];
}

/** 语料库数据访问。传 paperId 仅取该论文语料，不传取全部。 */
export function useCorpus(paperId?: string) {
  const [entries, setEntries] = useState<CorpusEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await paperCorpusApi.list(paperId);
      const list = (Array.isArray(rows) ? rows : [])
        .map(normalizeCorpusEntry)
        .filter((entry): entry is CorpusEntry => entry !== null);
      setEntries(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载语料库失败");
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addEntry = useCallback(async (input: CreateCorpusInput) => {
    if (!input.text.trim()) return null;
    try {
      const created = await paperCorpusApi.create({
        paper_id: input.paperId,
        text: input.text,
        note: input.note,
        page: input.page,
        tags: input.tags,
      });
      const entry = normalizeCorpusEntry(created);
      if (entry) {
        setEntries((current) => [entry, ...current]);
      } else {
        await reload();
      }
      setError("");
      return entry;
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存语料失败");
      return null;
    }
  }, [reload]);

  const updateNote = useCallback(async (id: string, note: string) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, note } : entry)));
    try {
      await paperCorpusApi.update(id, { note });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新语料失败");
    }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const snapshot = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    try {
      await paperCorpusApi.delete(id);
    } catch (err) {
      setEntries(snapshot);
      setError(err instanceof Error ? err.message : "删除语料失败");
    }
  }, [entries]);

  return { entries, loading, error, reload, addEntry, updateNote, deleteEntry };
}
