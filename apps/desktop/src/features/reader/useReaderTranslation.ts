import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings, LlmProvider } from "@research-copilot/types";
import { chatApi, translateApi, settingsApi } from "../../lib/client";
import type { ReaderImageSelection } from "./readerTypes";
import { splitReasoning } from "./readerReasoning";

function getDefaultChatModel(settings: AppSettings): string {
  const map: Record<LlmProvider, string> = {
    openai: settings.openai_chat_model,
    anthropic: settings.anthropic_chat_model,
    openai_compatible: settings.openai_compatible_chat_model,
  };
  return map[settings.llm_provider] ?? "";
}

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
  sourceType?: "text" | "image";
  imageDataUrl?: string;
  page?: number;
  text: string;
  error?: string;
}

interface InterpretRequest {
  source: string;
  prompt: string;
  sourceType?: "text" | "image";
  imageDataUrl?: string;
  page?: number;
  images?: Array<{ data: string; mediaType: string }>;
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
  const [translationModel, setTranslationModel] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");

  const seqRef = useRef(0);
  const currentRef = useRef<TranslationState | null>(null);
  const continuousRef = useRef(continuous);
  const translateAbortRef = useRef<AbortController | null>(null);
  const interpretAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);
  // 卸载时中止仍在进行的流，避免卸载后 setState 与未释放的网络流。
  useEffect(() => () => {
    translateAbortRef.current?.abort();
    interpretAbortRef.current?.abort();
  }, []);

  // 初始化译衡模型：优先使用设置中保存的 translation_model；未指定时回退到小妍默认模型。
  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    setModelsError("");
    (async () => {
      try {
        const settings = await settingsApi.get();
        if (cancelled) return;
        const defaultModel = getDefaultChatModel(settings);
        setTranslationModel(settings.translation_model || defaultModel);
        const models = await settingsApi.listModels(settings);
        if (cancelled) return;
        setAvailableModels(models);
        if (models.length === 0) {
          setModelsError("未获取到模型，请检查接口地址与密钥。");
        }
      } catch (error) {
        if (cancelled) return;
        setAvailableModels([]);
        setModelsError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runTranslate = useCallback(async (source: string, page?: number) => {
    const trimmed = normalizeSourceText(source);
    if (!trimmed) return;
    translateAbortRef.current?.abort();
    const ac = new AbortController();
    translateAbortRef.current = ac;
    const id = (seqRef.current += 1);
    setInterpretation(null); // 译文变化，旧解读作废
    setCurrent({ id, source: trimmed, page, result: "", status: "loading" });
    try {
      let rawResult = "";
      for await (const chunk of translateApi.stream(trimmed, "zh", undefined, translationModel, ac.signal)) {
        if (translateAbortRef.current !== ac) break;
        if (chunk.type === "delta") {
          rawResult += chunk.value;
          const result = splitReasoning(rawResult).answer;
          setCurrent((prev) => (prev && prev.id === id ? { ...prev, result } : prev));
        }
        if (chunk.type === "error") {
          setCurrent((prev) => (prev && prev.id === id ? { ...prev, status: "error", error: chunk.value || "翻译失败" } : prev));
        }
      }
      if (translateAbortRef.current === ac) {
        setCurrent((prev) => (
          prev && prev.id === id && prev.status !== "error"
            ? { ...prev, result: splitReasoning(rawResult).answer, status: "done" }
            : prev
        ));
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "翻译失败";
      setCurrent((prev) => (prev && prev.id === id ? { ...prev, status: "error", error: message } : prev));
    }
  }, [translationModel]);

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

  const runInterpretation = useCallback(async ({
    source,
    prompt,
    sourceType = "text",
    imageDataUrl,
    page,
    images,
  }: InterpretRequest) => {
    interpretAbortRef.current?.abort();
    const ac = new AbortController();
    interpretAbortRef.current = ac;
    const baseState = { source, sourceType, imageDataUrl, page };
    setInterpretation({ ...baseState, status: "loading", text: "" });
    let acc = "";
    try {
      // 不传 session_id：每次解读都是全新、无记忆的一次性对话（tag 让它不进导航对话列表）。
      for await (const chunk of chatApi.stream(
        { message: prompt, context_type: "general", chat_mode: "direct", tag: "reader-interpret", images },
        ac.signal,
      )) {
        if (interpretAbortRef.current !== ac) break;
        if (chunk.type === "delta") {
          acc += chunk.value;
          setInterpretation({ ...baseState, status: "loading", text: acc });
        }
        if (chunk.type === "error") {
          setInterpretation({ ...baseState, status: "error", text: acc, error: chunk.value || "解读失败" });
        }
      }
      if (interpretAbortRef.current === ac) {
        setInterpretation((prev) => (prev && prev.status === "error" ? prev : { ...baseState, status: "done", text: acc }));
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "解读失败";
      setInterpretation({ ...baseState, status: "error", text: acc, error: message });
    }
  }, []);

  // 解读：不传 source 时解读当前译文的原文（面板按钮）；传入则解读指定文字（划词「解读」）。
  const interpret = useCallback(async (sourceOverride?: string) => {
    const raw = sourceOverride ?? currentRef.current?.source ?? "";
    const source = sourceOverride ? normalizeSourceText(raw) : raw.trim();
    if (!source) return;
    const prompt =
      `请用中文解读下面这段学术原文：先点出它在讲什么，再解释其中的关键概念/术语，必要时说明其作用或意义。不要逐句翻译。\n\n原文：\n${source}`;
    await runInterpretation({ source, prompt });
  }, [runInterpretation]);

  // 划词「解读」：丢掉旧译文，仅就选中文字独立解读（面板只显示解读卡片）。
  const interpretText = useCallback(
    (text: string) => {
      setCurrent(null);
      void interpret(text);
    },
    [interpret],
  );

  const interpretImage = useCallback(
    (image: ReaderImageSelection) => {
      setCurrent(null);
      const source = `第 ${image.page} 页框选图像（${image.width} × ${image.height}）`;
      const prompt =
        "请用中文解读这张论文 PDF 中框选出来的图像区域。优先判断它可能是哪类图/表/公式/流程图，解释图中主要元素、坐标轴/图例/箭头/结构关系，以及它在论文论证中可能表达的结论。若局部文字看不清，请明确说明不确定，不要编造。";
      void runInterpretation({
        source,
        prompt,
        sourceType: "image",
        imageDataUrl: `data:${image.mediaType};base64,${image.data}`,
        page: image.page,
        images: [{ data: image.data, mediaType: image.mediaType }],
      });
    },
    [runInterpretation],
  );

  const toggleContinuous = useCallback(() => setContinuous((value) => !value), []);
  const toggleLock = useCallback(() => setLocked((value) => !value), []);

  const clear = useCallback(() => {
    translateAbortRef.current?.abort();
    translateAbortRef.current = null;
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
    translationModel,
    availableModels,
    loadingModels,
    modelsError,
    translate,
    editSource,
    interpret,
    interpretText,
    interpretImage,
    clear,
    setLocked,
    toggleLock,
    setContinuous,
    toggleContinuous,
    setFontSize,
    setTranslationModel,
  };
}
