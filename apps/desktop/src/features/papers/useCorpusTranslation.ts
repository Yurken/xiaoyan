import { useCallback, useRef, useState } from "react";
import { translateApi } from "../../lib/client";

export interface TranslationState {
  status: "loading" | "done" | "error";
  text: string;
  error?: string;
}

/**
 * 语料「翻译」状态：按语料 id 管理翻译结果。
 * 调用后端 translate_text 将语料原文译成中文，结果不落库，是即用即取的临时内容。
 */
export function useCorpusTranslation() {
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});
  const abortMap = useRef<Map<string, AbortController>>(new Map());

  const translate = useCallback(async (id: string, text: string) => {
    const source = text.trim();
    if (!source) return;
    abortMap.current.get(id)?.abort();
    const ac = new AbortController();
    abortMap.current.set(id, ac);
    setTranslations((prev) => ({ ...prev, [id]: { status: "loading", text: "" } }));
    try {
      const result = await translateApi.translate(source, "zh");
      if (abortMap.current.get(id) !== ac) return;
      setTranslations((prev) => ({ ...prev, [id]: { status: "done", text: result } }));
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "翻译失败";
      setTranslations((prev) => ({ ...prev, [id]: { status: "error", text: "", error: message } }));
    }
  }, []);

  const clearTranslation = useCallback((id: string) => {
    abortMap.current.get(id)?.abort();
    abortMap.current.delete(id);
    setTranslations((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return { translations, translate, clearTranslation };
}
