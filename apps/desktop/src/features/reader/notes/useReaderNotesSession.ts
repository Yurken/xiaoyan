import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { PaperNote } from "../readerTypes";
import type { ReaderNoteUndoEntry } from "./shared";

// 只共享请求顺序：返回同一论文须等旧操作落库，记录与撤销历史仍属于当前页面。
const persistenceTails = new Map<string, Promise<void>>();

/** 每篇论文拥有独立记录和撤销历史，已排队的请求跨页面挂载保持顺序。 */
export function useReaderNotesSession(paperId: string | undefined) {
  const session = useMemo(() => ({
    paperId,
    notes: [] as PaperNote[],
    undo: [] as ReaderNoteUndoEntry[],
    loading: Boolean(paperId),
    error: "",
    notify: null as (() => void) | null,
  }), [paperId]);
  const [, render] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    const notify = () => render();
    session.notify = notify;
    return () => { if (session.notify === notify) session.notify = null; };
  }, [session]);

  const run = useCallback((task: () => Promise<void>, failureMessage: string): Promise<void> => {
    if (!session.paperId) return Promise.resolve();
    const paperId = session.paperId;
    const previous = persistenceTails.get(paperId) ?? Promise.resolve();
    const next = previous.then(async () => {
      try {
        await task();
        session.error = "";
      } catch (error) {
        session.error = error instanceof Error ? error.message : failureMessage;
      } finally {
        session.notify?.();
      }
    });
    const tail = next.then(() => undefined, () => undefined);
    persistenceTails.set(paperId, tail);
    void tail.then(() => {
      if (persistenceTails.get(paperId) === tail) persistenceTails.delete(paperId);
    });
    return next;
  }, [session]);

  return { session, run };
}
