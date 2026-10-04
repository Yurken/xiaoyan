import { useCallback, useEffect, useMemo, useReducer } from "react";
import { paperCorpusApi } from "../../lib/client";
import { normalizeCorpusEntry, type CorpusEntry, type CreateCorpusInput } from "./corpusTypes";

// 请求尾队列跨挂载保留；全局范围与所有论文范围重叠，因此全局请求需要等待各范围尾部。
const persistenceTails = new Map<string | undefined, Promise<void>>();

/** 语料库数据访问。当前页面记录独立，请求按论文范围跨挂载串行；不传 ID 时展示全部。 */
export function useCorpus(paperId?: string) {
  const session = useMemo(() => ({
    paperId, entries: [] as CorpusEntry[], loading: true, error: "",
    notify: null as (() => void) | null,
  }), [paperId]);
  const [, render] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    const notify = () => render();
    session.notify = notify;
    return () => { if (session.notify === notify) session.notify = null; };
  }, [session]);

  const run = useCallback(<T,>(task: () => Promise<T>, fallback: string): Promise<T | null> => {
    const previous = session.paperId === undefined
      ? [...persistenceTails.values()]
      : [persistenceTails.get(session.paperId), persistenceTails.get(undefined)];
    const next = Promise.all(previous).then(async () => {
      try {
        const result = await task();
        session.error = "";
        return result;
      } catch (error) {
        session.error = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
        return null;
      } finally {
        session.notify?.();
      }
    });
    const tail = next.then(() => undefined, () => undefined);
    persistenceTails.set(session.paperId, tail);
    void tail.then(() => {
      if (persistenceTails.get(session.paperId) === tail) persistenceTails.delete(session.paperId);
    });
    return next;
  }, [session]);

  const reload = useCallback(() => run(async () => {
    session.loading = true;
    session.notify?.();
    try {
      const rows = await paperCorpusApi.list(session.paperId);
      session.entries = (Array.isArray(rows) ? rows : [])
        .map(normalizeCorpusEntry)
        .filter((entry): entry is CorpusEntry => entry !== null && (!session.paperId || entry.paper_id === session.paperId));
      return true;
    } finally {
      session.loading = false;
    }
  }, "加载语料库失败"), [run, session]);

  useEffect(() => { void reload(); }, [reload]);

  const addEntry = useCallback((input: CreateCorpusInput): Promise<CorpusEntry | null> => {
    if (!input.text.trim()) return Promise.resolve(null);
    return run(async () => {
      const targetId = input.paperId ?? session.paperId;
      const created = await paperCorpusApi.create({
        paper_id: targetId, text: input.text, note: input.note, page: input.page, tags: input.tags,
      });
      const entry = normalizeCorpusEntry(created);
      if (!entry || (targetId && entry.paper_id !== targetId)) {
        throw new Error("保存语料返回了无效记录，请重新加载语料库。");
      }
      if (!session.paperId || entry.paper_id === session.paperId) {
        session.entries = [entry, ...session.entries.filter((item) => item.id !== entry.id)];
      }
      return entry;
    }, "保存语料失败");
  }, [run, session]);

  const updateNote = useCallback((id: string, note: string) => run(async () => {
    const previous = session.entries.find((entry) => entry.id === id);
    if (!previous) throw new Error("未找到对应语料，请重新加载语料库。");
    const updated = normalizeCorpusEntry(await paperCorpusApi.update(id, { note }));
    session.entries = session.entries.map((entry) => entry.id === id
      ? updated && updated.id === id && updated.paper_id === previous.paper_id ? updated : { ...entry, note }
      : entry);
    return true;
  }, "更新语料失败"), [run, session]);

  const deleteEntry = useCallback((id: string) => run(async () => {
    await paperCorpusApi.delete(id);
    session.entries = session.entries.filter((entry) => entry.id !== id);
    return true;
  }, "删除语料失败"), [run, session]);

  return {
    entries: session.entries, loading: session.loading, error: session.error,
    reload, addEntry, updateNote, deleteEntry,
  };
}
