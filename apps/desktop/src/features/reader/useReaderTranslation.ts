import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi, translateApi } from "../../lib/client";

export interface TranslationState {
  id: number;
  source: string;
  page?: number;
  result: string;
  status: "loading" | "done" | "error";
  error?: string;
}

export interface InterpretationState {
  status: "loading" | "done" | "error";
  /** 被解读的原文（划词「解读」无译文时，面板据此展示原文）。 */
  source: string;
  text: string;
  error?: string;
}

export const TRANSLATION_FONT_SIZES = [12, 13, 14, 16, 18, 20] as const;
const DEFAULT_FONT_SIZE = 14;

/**
 * 归一化划词原文：PDF 提取的文字带有逐行硬换行（含行尾断词连字符），
 * 拼成连续文本——既让原文展示无换行，也让送去翻译的文本更通顺。
 */
export function normalizeSourceText(raw: string): string {
  return raw
    .replace(/([A-Za-z])-\s*\n\s*([a-z])/g, "$1$2") // 行尾断词：chal-\nlenges → challenges
    .replace(/\s*\n\s*/g, " ") // 其余换行 → 空格
    .replace(/[ \t]+/g, " ") // 合并多余空白
    .trim();
}

/**
 * 阅读器翻译面板状态：只保留「当前一条」翻译（译文 + 原文完整展示）。
 * - 连续翻译：开启时把新选中的文字接到上一段后面，合并成完整文本重新翻译（专治跨页断句）。
 * - 锁定：由调用方在划词处拦截，锁定后不再自动翻译、固定当前内容。
 * - 解读：对当前原文调用 AI 对话生成讲解（流式）。
 */
export function useReaderTranslation() {
  const [current, setCurrent] = useState<TranslationState | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationState | null>(null);
  const [locked, setLocked] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);

  const seqRef = useRef(0);
  const currentRef = useRef<TranslationState | null>(null);
  const continuousRef = useRef(continuous);
  const interpretAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  const runTranslate = useCallback(async (source: string, page?: number) => {
    const trimmed = normalizeSourceText(source);
    if (!trimmed) return;
    const id = (seqRef.current += 1);
    setInterpretation(null); // 译文变化，旧解读作废
    setCurrent({ id, source: trimmed, page, result: "", status: "loading" });
    try {
      const result = await translateApi.translate(trimmed, "zh");
      setCurrent((prev) => (prev && prev.id === id ? { ...prev, result: result.trim(), status: "done" } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "翻译失败";
      setCurrent((prev) => (prev && prev.id === id ? { ...prev, status: "error", error: message } : prev));
    }
  }, []);

  // 划词翻译：连翻开启且已有结果时，把新选中文字接到上一段后合并重译；否则另起一段。
  const translate = useCallback(
    (text: string, page?: number) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const prev = currentRef.current;
      if (continuousRef.current && prev && prev.status !== "error") {
        const merged = `${prev.source} ${trimmed}`.replace(/\s+/g, " ").trim();
        void runTranslate(merged, prev.page ?? page);
      } else {
        void runTranslate(trimmed, page);
      }
    },
    [runTranslate],
  );

  // 修改原文后按编辑结果整体重译（不走合并）。
  const editSource = useCallback(
    (text: string) => {
      void runTranslate(text, currentRef.current?.page);
    },
    [runTranslate],
  );

  // 解读：不传 source 时解读当前译文的原文（面板按钮）；传入则解读指定文字（划词「解读」）。
  const interpret = useCallback(async (sourceOverride?: string) => {
    const raw = sourceOverride ?? currentRef.current?.source ?? "";
    const source = sourceOverride ? normalizeSourceText(raw) : raw.trim();
    if (!source) return;
    interpretAbortRef.current?.abort();
    const ac = new AbortController();
    interpretAbortRef.current = ac;
    setInterpretation({ status: "loading", source, text: "" });
    const prompt =
      `请用中文解读下面这段学术原文：先点出它在讲什么，再解释其中的关键概念/术语，必要时说明其作用或意义。不要逐句翻译。\n\n原文：\n${source}`;
    let acc = "";
    try {
      // 不传 session_id：每次解读都是全新、无记忆的一次性对话（tag 让它不进导航对话列表）。
      for await (const chunk of chatApi.stream(
        { message: prompt, context_type: "general", chat_mode: "direct", tag: "reader-interpret" },
        ac.signal,
      )) {
        if (interpretAbortRef.current !== ac) break;
        if (chunk.type === "delta") {
          acc += chunk.value;
          setInterpretation({ status: "loading", source, text: acc });
        }
        if (chunk.type === "error") {
          setInterpretation({ status: "error", source, text: acc, error: chunk.value || "解读失败" });
        }
      }
      if (interpretAbortRef.current === ac) {
        setInterpretation((prev) => (prev && prev.status === "error" ? prev : { status: "done", source, text: acc }));
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "解读失败";
      setInterpretation({ status: "error", source, text: acc, error: message });
    }
  }, []);

  // 划词「解读」：丢掉旧译文，仅就选中文字独立解读（面板只显示解读卡片）。
  const interpretText = useCallback(
    (text: string) => {
      setCurrent(null);
      void interpret(text);
    },
    [interpret],
  );

  const toggleContinuous = useCallback(() => setContinuous((value) => !value), []);
  const toggleLock = useCallback(() => setLocked((value) => !value), []);

  const clear = useCallback(() => {
    interpretAbortRef.current?.abort();
    interpretAbortRef.current = null;
    setCurrent(null);
    setInterpretation(null);
  }, []);

  return {
    current,
    interpretation,
    locked,
    continuous,
    fontSize,
    translate,
    editSource,
    interpret,
    interpretText,
    clear,
    setLocked,
    toggleLock,
    setContinuous,
    toggleContinuous,
    setFontSize,
  };
}
