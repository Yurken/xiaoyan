import { useEffect, useRef, useState } from "react";
import { buildPptx, extractJsonObject, normalizePptData, sanitizePptFileName } from "./ppt";
import { buildPptPrompt, buildPptRepairPrompt } from "./pptPrompt";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { parsePptPageCount, type PptData, type PptMode, type PptStatus } from "./pptShared";

function isGeneratingStatus(status: PptStatus) {
  return status === "drafting" || status === "repairing" || status === "building";
}

export function usePptGenerator() {
  const [mode, setMode] = useState<PptMode>("topic");
  const [topic, setTopic] = useState("");
  const [outline, setOutline] = useState("");
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [styleValue, setStyleValue] = useState("auto");
  const [customStyle, setCustomStyle] = useState("");
  const [language, setLanguage] = useState("auto");
  const [pageCount, setPageCount] = useState("auto");
  const [customPages, setCustomPages] = useState("");
  const [status, setStatus] = useState<PptStatus>("idle");
  const [slideCount, setSlideCount] = useState(0);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [pptData, setPptData] = useState<PptData | null>(null);
  const [error, setError] = useState("");
  const [skillEnabled, setSkillEnabled] = useState<boolean | null>(null);
  const [documentError, setDocumentError] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);
  const [fileBaseName, setFileBaseName] = useState("slides");
  const runIdRef = useRef(0);
  const documentRunIdRef = useRef(0);
  const prevInputKeyRef = useRef("");

  useEffect(() => {
    apiClient.skills.list().then((skills) => {
      const skill = skills.find((item) => item.name === "ppt-generate");
      setSkillEnabled(skill?.is_enabled !== false);
    }).catch(() => setSkillEnabled(false));
  }, []);

  const featureDisabled = skillEnabled === false;

  useEffect(() => {
    const inputKey = JSON.stringify([
      mode,
      topic,
      outline,
      documentContent,
      documentName,
      styleValue,
      customStyle,
      language,
      pageCount,
      customPages,
    ]);
    if (inputKey === prevInputKeyRef.current) return;
    prevInputKeyRef.current = inputKey;

    if (isGeneratingStatus(status)) {
      runIdRef.current += 1;
      setStatus("idle");
      setBuffer(null);
      setPptData(null);
      setSlideCount(0);
      setError("");
      return;
    }

    if (status !== "ready" && status !== "error") return;
    setStatus("idle");
    setBuffer(null);
    setPptData(null);
    setSlideCount(0);
    setError("");
  }, [
    customPages,
    customStyle,
    documentContent,
    documentName,
    language,
    mode,
    outline,
    pageCount,
    status,
    styleValue,
    topic,
  ]);

  const resetDocument = () => {
    documentRunIdRef.current += 1;
    setDocumentName(null);
    setDocumentContent(null);
    setDocumentError("");
    setDocumentLoading(false);
  };

  const loadDocument = async (name: string, loader: () => Promise<string>) => {
    const documentRunId = ++documentRunIdRef.current;
    setDocumentName(name);
    setDocumentLoading(true);
    setDocumentContent(null);
    setDocumentError("");
    try {
      const text = await loader();
      if (documentRunId !== documentRunIdRef.current) return;
      setDocumentContent(text);
    } catch (err) {
      if (documentRunId !== documentRunIdRef.current) return;
      setDocumentContent(null);
      setDocumentError(formatErrorMessage(err));
    } finally {
      if (documentRunId === documentRunIdRef.current) {
        setDocumentLoading(false);
      }
    }
  };

  const handleDocumentDrop = async (file: File) => {
    const droppedFile = file as File & { path?: string };
    if (file.name.toLowerCase().endsWith(".pdf")) {
      if (!droppedFile.path) {
        setDocumentName(file.name);
        setDocumentContent(null);
        setDocumentError("拖拽的 PDF 无法获取本地路径，请使用“本地文件”按钮选择 PDF。");
        setDocumentLoading(false);
        return;
      }
      await loadDocument(file.name, () => apiClient.papers.extractPdfText(droppedFile.path as string));
      return;
    }

    await loadDocument(file.name, () => file.text());
  };

  const handleDocumentPick = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({
      filters: [{ name: "文档", extensions: ["pdf", "txt", "md"] }],
      multiple: false,
    });
    if (typeof path !== "string") return;

    const name = path.split("/").pop() ?? path;
    if (name.toLowerCase().endsWith(".pdf")) {
      await loadDocument(name, () => apiClient.papers.extractPdfText(path));
      return;
    }

    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    await loadDocument(name, () => readTextFile(path));
  };

  const customPageInvalid = pageCount === "custom" && parsePptPageCount(customPages) === null;
  const documentCharacterCount = documentContent?.length ?? 0;
  const generating = isGeneratingStatus(status);
  const generateDisabledReason = featureDisabled
    ? "请先在技能库中启用 PPT 生成功能。"
    : generating
      ? "当前正在生成，请等待完成。"
      : mode === "topic" && !topic.trim()
        ? "先输入演示主题。"
        : mode === "outline" && !outline.trim()
          ? "先粘贴汇报大纲。"
          : mode === "document" && documentLoading
            ? "文档仍在读取中。"
            : mode === "document" && !documentContent
              ? "先导入一份文档内容。"
              : Boolean(documentError)
                ? "请先修复文档读取错误。"
                : styleValue === "custom" && !customStyle.trim()
                  ? "先填写自定义风格描述。"
                  : customPageInvalid
                    ? "页数需填写 4 到 40 之间的整数。"
                    : "";

  const streamMessage = async (message: string, runId: number, sessionId?: string) => {
    let raw = "";
    let nextSessionId = sessionId ?? "";

    for await (const chunk of apiClient.chat.stream({
      message,
      session_id: sessionId || undefined,
      chat_mode: "direct",
      tag: "1",
    })) {
      if (runId !== runIdRef.current) return null;
      if (chunk.type === "session_id") nextSessionId = chunk.value;
      else if (chunk.type === "delta") raw += chunk.value;
      else if (chunk.type === "error") throw new Error(chunk.value as string);
    }

    return { raw, sessionId: nextSessionId };
  };

  const parsePptResponse = (raw: string) => normalizePptData(JSON.parse(extractJsonObject(raw)));

  const generate = async () => {
    if (generateDisabledReason) return;

    const prompt = buildPptPrompt({
      mode,
      topic,
      outline,
      documentContent,
      styleValue,
      customStyle,
      language,
      pageCount,
      customPages,
    });

    const runId = ++runIdRef.current;
    setStatus("drafting");
    setBuffer(null);
    setPptData(null);
    setSlideCount(0);
    setError("");

    try {
      const firstPass = await streamMessage(prompt, runId);
      if (!firstPass) return;

      let data: PptData;
      try {
        data = parsePptResponse(firstPass.raw);
      } catch {
        if (runId !== runIdRef.current) return;
        setStatus("repairing");
        const repaired = await streamMessage(buildPptRepairPrompt(firstPass.raw), runId, firstPass.sessionId);
        if (!repaired) return;
        data = parsePptResponse(repaired.raw);
      }

      if (runId !== runIdRef.current) return;
      setStatus("building");
      const nextBuffer = await buildPptx(data);
      if (runId !== runIdRef.current) return;

      setSlideCount(data.slides.length);
      setBuffer(nextBuffer);
      setPptData(data);
      setFileBaseName(sanitizePptFileName(data.title));
      setStatus("ready");
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(formatErrorMessage(err));
      setStatus("error");
    }
  };

  const download = async () => {
    if (!buffer) {
      setError("文件数据为空，请重新生成。");
      return;
    }
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
        defaultPath: `${fileBaseName}.pptx`,
      });
      if (path) {
        await writeFile(path, new Uint8Array(buffer));
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  };

  return {
    featureDisabled,
    mode,
    topic,
    outline,
    documentName,
    documentLoading,
    documentError,
    hasDocumentContent: Boolean(documentContent),
    styleValue,
    customStyle,
    language,
    pageCount,
    customPages,
    fileBaseName,
    documentCharacterCount,
    generateDisabledReason,
    pptData,
    status,
    slideCount,
    error,
    setMode,
    setTopic,
    setOutline,
    setStyleValue,
    setCustomStyle,
    setLanguage,
    setPageCount,
    setCustomPages,
    resetDocument,
    handleDocumentDrop,
    handleDocumentPick,
    generate,
    download,
  };
}
