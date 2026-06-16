import { useCallback, useRef, useState } from "react";
import { translateApi } from "../../lib/client";

export interface TranslationEntry {
  id: string;
  source: string;
  page?: number;
  result: string;
  status: "loading" | "done" | "error";
  error?: string;
}

/** 阅读器右侧翻译面板的状态管理：每次划词翻译追加一条记录。 */
export function useReaderTranslation() {
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const seqRef = useRef(0);

  const translate = useCallback(async (text: string, page?: number) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = `t${(seqRef.current += 1)}`;
    setEntries((prev) => [{ id, source: trimmed, page, result: "", status: "loading" }, ...prev]);
    try {
      const result = await translateApi.translate(trimmed, "zh");
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, result: result.trim(), status: "done" } : entry)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "翻译失败";
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, status: "error", error: message } : entry)),
      );
    }
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, translate, remove, clear };
}
