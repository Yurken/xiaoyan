import { useEffect, useRef, useState } from "react";
import { buildPptx, extractJsonObject, normalizePptData, sanitizePptFileName } from "./ppt";
import { apiClient, formatErrorMessage } from "../../lib/client";

type PptMode = "topic" | "document" | "outline";
type PptStatus = "idle" | "llm" | "building" | "ready" | "error";

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
  const [error, setError] = useState("");
  const [skillEnabled, setSkillEnabled] = useState<boolean | null>(null);
  const [documentError, setDocumentError] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);
  const [fileBaseName, setFileBaseName] = useState("slides");
  const runIdRef = useRef(0);

  useEffect(() => {
    apiClient.skills.list().then((skills) => {
      const skill = skills.find((item) => item.name === "ppt-generate");
      setSkillEnabled(skill?.is_enabled !== false);
    }).catch(() => setSkillEnabled(false));
  }, []);

  const featureDisabled = skillEnabled === false;

  useEffect(() => {
    if (status !== "ready" && status !== "error") return;
    setStatus("idle");
    setBuffer(null);
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
    setDocumentName(null);
    setDocumentContent(null);
    setDocumentError("");
    setDocumentLoading(false);
  };

  const loadDocument = async (name: string, loader: () => Promise<string>) => {
    setDocumentName(name);
    setDocumentLoading(true);
    setDocumentContent(null);
    setDocumentError("");
    try {
      const text = await loader();
      setDocumentContent(text);
    } catch (err) {
      setDocumentContent(null);
      setDocumentError(formatErrorMessage(err));
    } finally {
      setDocumentLoading(false);
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

  const generate = async () => {
    if (featureDisabled || status === "llm" || status === "building") return;

    const jsonSchema = `{\n  "title": "演示标题",\n  "slides": [\n    { "layout": "title", "title": "主标题", "subtitle": "副标题" },\n    { "layout": "section", "title": "章节名", "subtitle": "章节说明（可选）" },\n    { "layout": "content", "title": "幻灯片标题", "bullets": ["要点1", "要点2", "要点3"] },\n    { "layout": "two_column", "title": "对比标题", "left": ["左侧1", "左侧2"], "right": ["右侧1", "右侧2"] }\n  ]\n}`;
    const languageHintMap: Record<string, string> = {
      auto: "语言根据主题自动决定（中文主题用中文，英文主题用英文）",
      zh: "全程使用中文",
      en: "全 content in English",
    };

    const effectiveStyle = styleValue === "custom" ? customStyle.trim() : styleValue;
    const effectivePages = pageCount === "custom" ? customPages.trim() : pageCount;
    const customPageCount = Number.parseInt(effectivePages, 10);
    const styleHint = effectiveStyle === "auto" || !effectiveStyle
      ? "根据科研主题与内容深度自行判断最合适的学术风格"
      : `${effectiveStyle}风格`;
    const languageHint = languageHintMap[language] ?? languageHintMap.auto;
    const pageHint = effectivePages === "auto" || !Number.isFinite(customPageCount)
      ? "页数由小妍根据内容深度自动决定（建议 10～16 页）"
      : `总页数控制在 ${Math.min(40, Math.max(4, customPageCount))} 页左右（含标题页和致谢页）`;
    const commonRules = `\n风格：${styleHint}\n语言：${languageHint}\n页数：${pageHint}\n其他规则：\n- layout 只能是 title / section / content / two_column\n- 第一页固定 title 布局，最后一页用 title 布局作为致谢页\n- 包含 2～3 个 section 分隔页\n- bullets 每条不超过 20 字，最多 5 条\n- two_column 用于对比或并列内容`;

    let prompt = "";
    if (mode === "topic") {
      if (!topic.trim()) return;
      prompt = `请为演示主题"${topic.trim()}"生成幻灯片数据。\n\n只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明，格式严格如下：\n${jsonSchema}\n${commonRules}`;
    } else if (mode === "outline") {
      if (!outline.trim()) return;
      prompt = `请根据以下大纲生成幻灯片数据：\n\n${outline.trim()}\n\n只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明，格式严格如下：\n${jsonSchema}\n${commonRules}\n- 严格按照大纲层级组织幻灯片`;
    } else {
      if (!documentContent || documentError) return;
      prompt = `请根据以下文档内容生成幻灯片数据：\n\n${documentContent.slice(0, 4000)}\n\n只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明，格式严格如下：\n${jsonSchema}\n${commonRules}\n- 提炼文档核心内容`;
    }

    const runId = ++runIdRef.current;
    setStatus("llm");
    setBuffer(null);
    setSlideCount(0);
    setError("");

    try {
      let raw = "";
      for await (const chunk of apiClient.chat.stream({ message: prompt })) {
        if (runId !== runIdRef.current) return;
        if (chunk.type === "delta") raw += chunk.value;
        else if (chunk.type === "error") throw new Error(chunk.value as string);
      }

      const jsonString = extractJsonObject(raw);
      const data = normalizePptData(JSON.parse(jsonString));

      if (runId !== runIdRef.current) return;
      setStatus("building");
      const nextBuffer = await buildPptx(data);
      if (runId !== runIdRef.current) return;

      setSlideCount(data.slides.length);
      setBuffer(nextBuffer);
      setFileBaseName(sanitizePptFileName(data.title));
      setStatus("ready");
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(formatErrorMessage(err));
      setStatus("error");
    }
  };

  const download = async () => {
    if (!buffer) return;
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
      defaultPath: `${fileBaseName}.pptx`,
    });
    if (path) {
      await writeFile(path, new Uint8Array(buffer));
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
