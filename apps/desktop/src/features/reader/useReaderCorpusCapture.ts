import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCorpus } from "../papers/useCorpus";
import type { ReaderSelection } from "./readerTypes";

/** 阅读选区保存与反馈统一留在功能 hook，页面只组合交互。 */
export function useReaderCorpusCapture({ paperId, selection, clearSelection }: {
  paperId?: string;
  selection: ReaderSelection | null;
  clearSelection: () => void;
}) {
  const { addEntry, error } = useCorpus(paperId);
  const scope = useMemo(() => ({ paperId, active: true }), [paperId]);
  const current = useRef({ scope, selection });
  current.current = { scope, selection };
  const pendingSelections = useRef(new Set<ReaderSelection>());
  const timer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [feedback, setFeedback] = useState({ scope, message: "" });

  useEffect(() => {
    scope.active = true;
    return () => {
      scope.active = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [scope]);

  const flashToast = useCallback((message: string) => {
    if (current.current.scope !== scope || !scope.active) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    setFeedback({ scope, message });
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setFeedback((previous) => previous.scope === scope ? { scope, message: "" } : previous);
    }, 1800);
  }, [scope]);

  const saveSelection = useCallback(async (note?: string) => {
    if (!selection || !paperId || pendingSelections.current.has(selection)) return;
    pendingSelections.current.add(selection);
    try {
      const entry = await addEntry({ paperId, text: selection.text, page: selection.page, note });
      if (current.current.scope !== scope || !scope.active) return;
      if (!entry) {
        flashToast("收入语料库失败，请重试。");
        return;
      }
      if (current.current.selection === selection) clearSelection();
      flashToast("已收入语料库");
    } finally {
      pendingSelections.current.delete(selection);
    }
  }, [addEntry, clearSelection, flashToast, paperId, scope, selection]);

  return {
    toast: feedback.scope === scope ? feedback.message : "",
    flashToast, saveSelection, error,
  };
}
