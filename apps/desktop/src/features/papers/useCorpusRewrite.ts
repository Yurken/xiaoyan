import { useCallback, useRef, useState } from "react";
import { chatApi } from "../../lib/client";

export interface RewriteState {
  status: "loading" | "done" | "error";
  text: string;
  error?: string;
}

/**
 * 语料「改写」状态：按语料 id 管理小妍的改写结果（流式）。
 * 改写目标是可直接用于论文写作/引用的换述——保留原意与术语、换句式以避免照搬，
 * 并使用与原文相同的语言。结果不落库，是即用即取的临时内容。
 */
export function useCorpusRewrite() {
  const [rewrites, setRewrites] = useState<Record<string, RewriteState>>({});
  const sessionRef = useRef<string | undefined>(undefined);
  const abortMap = useRef<Map<string, AbortController>>(new Map());

  const rewrite = useCallback(async (id: string, text: string) => {
    const source = text.trim();
    if (!source) return;
    abortMap.current.get(id)?.abort();
    const ac = new AbortController();
    abortMap.current.set(id, ac);
    setRewrites((prev) => ({ ...prev, [id]: { status: "loading", text: "" } }));
    const prompt =
      `请把下面这句改写成可直接用于论文写作/引用的表述：保持原意与专业术语，使用与原文相同的语言，` +
      `换一种句式与措辞以避免直接照搬（查重友好），输出通顺规范的书面表达。只给出改写后的句子本身，不要任何解释或前后缀。\n\n原文：\n${source}`;
    let acc = "";
    try {
      for await (const chunk of chatApi.stream(
        { session_id: sessionRef.current, message: prompt, context_type: "general", chat_mode: "direct", tag: "corpus-rewrite" },
        ac.signal,
      )) {
        if (abortMap.current.get(id) !== ac) break;
        if (chunk.type === "session_id") sessionRef.current = chunk.value;
        if (chunk.type === "delta") {
          acc += chunk.value;
          setRewrites((prev) => ({ ...prev, [id]: { status: "loading", text: acc } }));
        }
        if (chunk.type === "error") {
          setRewrites((prev) => ({ ...prev, [id]: { status: "error", text: acc, error: chunk.value || "改写失败" } }));
        }
      }
      if (abortMap.current.get(id) === ac) {
        setRewrites((prev) => {
          const current = prev[id];
          if (current && current.status === "error") return prev;
          return { ...prev, [id]: { status: "done", text: acc } };
        });
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "改写失败";
      setRewrites((prev) => ({ ...prev, [id]: { status: "error", text: acc, error: message } }));
    }
  }, []);

  const clearRewrite = useCallback((id: string) => {
    abortMap.current.get(id)?.abort();
    abortMap.current.delete(id);
    setRewrites((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return { rewrites, rewrite, clearRewrite };
}
