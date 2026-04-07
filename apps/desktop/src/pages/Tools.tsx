import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, CalendarDays, ChevronDown, FileText, Globe2, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { Badge, Button, Card, Input, Textarea } from "@research-copilot/ui";
import type { ArxivRankingMode, ArxivSearchRequest, ArxivSearchResponse, Skill, SourceLookupSection } from "@research-copilot/types";
import { buildPptx, extractJsonObject, normalizePptData, sanitizePptFileName, type PptData } from "../features/tools/ppt";
import { MarkdownFormatterPanel } from "../features/tools/MarkdownFormatterPanel";
import { PptWorkspace } from "../features/tools/PptWorkspace";
import { SourceLookupPanel } from "../features/tools/SourceLookupPanel";
import {
  ARXIV_CATEGORIES,
  ARXIV_MODE_OPTIONS,
  CS_GROUPS,
  DOMAIN_VENUES,
  NON_CS_KEYS,
  RANK_OPTIONS,
  buildAppliedFilterEntries,
  computeStaticVenues,
  formatDate,
  friendLinkInitial,
  friendLinkSectionId,
  hasStructuredArxivTerms,
  scoreVariant,
  splitStructuredInput,
  truncateText,
  type RankKey,
} from "../features/tools/shared";
import { TranslationPanel } from "../features/tools/TranslationPanel";
import { apiClient, formatErrorMessage, journalApi } from "../lib/client";
import { YANWEB_FRIEND_LINK_SECTIONS, YANWEB_FRIEND_LINK_TOTAL } from "../lib/yanweb-links";

const insetShadow = "var(--rc-inset-shadow)";
const raisedShadow = "var(--rc-raised-shadow)";

export default function Tools() {
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceSections, setSourceSections] = useState<SourceLookupSection[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceSearched, setSourceSearched] = useState(false);

  const [arxivTopic, setArxivTopic] = useState("");
  const [arxivAllTerms, setArxivAllTerms] = useState("");
  const [arxivTitleTerms, setArxivTitleTerms] = useState("");
  const [arxivAbstractTerms, setArxivAbstractTerms] = useState("");
  const [arxivAuthors, setArxivAuthors] = useState("");
  const [arxivCategories, setArxivCategories] = useState<string[]>([]);

  const [arxivCommentsTerms, setArxivCommentsTerms] = useState("");
  const [arxivJournalTerms, setArxivJournalTerms] = useState("");
  const [arxivExcludeTerms, setArxivExcludeTerms] = useState("");
  const [venueFilterDomains, setVenueFilterDomains] = useState<string[]>([]);
  const [venueFilterType, setVenueFilterType] = useState<"all" | "conference" | "journal">("all");
  const [venueFilterRanks, setVenueFilterRanks] = useState<RankKey[]>([]);
  const [venueFilterLoading, setVenueFilterLoading] = useState(false);
  const [dynamicJournalTerms, setDynamicJournalTerms] = useState<string[]>([]);
  const [arxivDays, setArxivDays] = useState("14");
  const [arxivLimit, setArxivLimit] = useState("6");
  const [arxivMode, setArxivMode] = useState<ArxivRankingMode>("relevance");
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState("");
  const [arxivSearched, setArxivSearched] = useState(false);
  const [arxivResult, setArxivResult] = useState<ArxivSearchResponse | null>(null);
  const arxivLastSearchAt = useRef<number>(0);
  const [arxivOnlyTopic, setArxivOnlyTopic] = useState("");
  const [arxivOnlyAllTerms, setArxivOnlyAllTerms] = useState("");
  const [arxivOnlyTitleTerms, setArxivOnlyTitleTerms] = useState("");
  const [arxivOnlyAbstractTerms, setArxivOnlyAbstractTerms] = useState("");
  const [arxivOnlyAuthors, setArxivOnlyAuthors] = useState("");
  const [arxivOnlyCategories, setArxivOnlyCategories] = useState<string[]>([]);
  const [arxivOnlyCatPickerOpen, setArxivOnlyCatPickerOpen] = useState(false);
  const [arxivOnlyCommentsTerms, setArxivOnlyCommentsTerms] = useState("");
  const [arxivOnlyJournalTerms, setArxivOnlyJournalTerms] = useState("");
  const [arxivOnlyExcludeTerms, setArxivOnlyExcludeTerms] = useState("");
  const [arxivOnlyDays, setArxivOnlyDays] = useState("30");
  const [arxivOnlyLimit, setArxivOnlyLimit] = useState("8");
  const [arxivOnlyMode, setArxivOnlyMode] = useState<ArxivRankingMode>("relevance");
  const [arxivOnlyLoading, setArxivOnlyLoading] = useState(false);
  const [arxivOnlyError, setArxivOnlyError] = useState("");
  const [arxivOnlySearched, setArxivOnlySearched] = useState(false);
  const [arxivOnlyResult, setArxivOnlyResult] = useState<ArxivSearchResponse | null>(null);
  const arxivOnlyLastSearchAt = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<"arxiv" | "source" | "links" | "translate" | "md" | "ppt">("arxiv");

  // PPT
  const [pptMode, setPptMode] = useState<"topic" | "document" | "outline">("topic");
  const [pptTopic, setPptTopic] = useState("");
  const [pptOutline, setPptOutline] = useState("");
  const [pptDocName, setPptDocName] = useState<string | null>(null);
  const [pptDocContent, setPptDocContent] = useState<string | null>(null);
  const [pptStyle, setPptStyle] = useState("auto");
  const [pptCustomStyle, setPptCustomStyle] = useState("");
  const [pptLang, setPptLang] = useState("auto");
  const [pptPages, setPptPages] = useState("auto");
  const [pptCustomPages, setPptCustomPages] = useState("");
  const [pptStatus, setPptStatus] = useState<"idle" | "llm" | "building" | "ready" | "error">("idle");
  const [pptSlideCount, setPptSlideCount] = useState(0);
  const [pptBuffer, setPptBuffer] = useState<ArrayBuffer | null>(null);
  const [pptError, setPptError] = useState("");
  const [pptSkill, setPptSkill] = useState<Skill | null | undefined>(undefined); // undefined = loading
  const [pptDocError, setPptDocError] = useState("");
  const [pptDocLoading, setPptDocLoading] = useState(false);
  const [pptFileBaseName, setPptFileBaseName] = useState("slides");
  const pptRunIdRef = useRef(0);

  const [mdInput, setMdInput] = useState("");
  const [mdResult, setMdResult] = useState("");
  const [mdProcessing, setMdProcessing] = useState(false);
  const [mdError, setMdError] = useState("");
  const [mdProgress, setMdProgress] = useState<{ current: number; total: number } | null>(null);

  const [translateInput, setTranslateInput] = useState("");
  const [translateResult, setTranslateResult] = useState("");
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [translateSourceLang, setTranslateSourceLang] = useState("auto");
  const [translateTargetLang, setTranslateTargetLang] = useState("zh");
  const [openFriendSections, setOpenFriendSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => [section.title, index === 0]))
  );

  useEffect(() => {
    apiClient.skills.list().then((skills) => {
      const skill = skills.find((s) => s.name === "ppt-generate") ?? null;
      setPptSkill(skill);
    }).catch(() => setPptSkill(null));
  }, []);

  const pptFeatureDisabled = pptSkill?.is_enabled === false;

  useEffect(() => {
    if (pptStatus !== "ready" && pptStatus !== "error") return;
    setPptStatus("idle");
    setPptBuffer(null);
    setPptSlideCount(0);
    setPptError("");
  }, [
    pptDocContent,
    pptDocName,
    pptLang,
    pptMode,
    pptOutline,
    pptPages,
    pptCustomPages,
    pptStyle,
    pptCustomStyle,
    pptTopic,
  ]);

  useEffect(() => {
    if (venueFilterDomains.length === 0 || venueFilterRanks.length === 0) {
      setArxivCategories([]);
      setArxivJournalTerms("");
      setDynamicJournalTerms([]);
      return;
    }

    // Sync: static CCF / CAS1-2
    const { categories, journalTerms: staticTerms } = computeStaticVenues(venueFilterDomains, venueFilterType, venueFilterRanks);
    setArxivCategories(categories);

    // Async: dynamic ranks (JCR / CAS3-4 / cas_top / scie / ssci)
    const dynamicRanks = venueFilterRanks.filter((r) => RANK_OPTIONS.find((o) => o.key === r)?.dynamic);
    if (dynamicRanks.length === 0) {
      setDynamicJournalTerms([]);
      setArxivJournalTerms(staticTerms.join(", "));
      return;
    }

    const wosCats = [...new Set(venueFilterDomains.flatMap((dk) => DOMAIN_VENUES[dk]?.wosCats ?? []))];
    // Only fetch journals when type includes journals
    const fetchForJournals = venueFilterType === "all" || venueFilterType === "journal";
    if (!fetchForJournals) {
      setDynamicJournalTerms([]);
      setArxivJournalTerms(staticTerms.join(", "));
      return;
    }

    setVenueFilterLoading(true);
    journalApi.rankFilter(wosCats, dynamicRanks).then((titles) => {
      setDynamicJournalTerms(titles);
      const all = [...new Set([...staticTerms, ...titles])];
      setArxivJournalTerms(all.join(", "));
    }).catch(() => {
      setDynamicJournalTerms([]);
      setArxivJournalTerms(staticTerms.join(", "));
    }).finally(() => setVenueFilterLoading(false));
  }, [venueFilterDomains, venueFilterType, venueFilterRanks]);

  const currentMode = useMemo(
    () => ARXIV_MODE_OPTIONS.find((item) => item.value === arxivMode) ?? ARXIV_MODE_OPTIONS[0],
    [arxivMode]
  );
  const arxivRequest = useMemo<ArxivSearchRequest>(
    () => ({
      topic: arxivTopic.trim(),
      all_terms: splitStructuredInput(arxivAllTerms),
      title_terms: splitStructuredInput(arxivTitleTerms),
      abstract_terms: splitStructuredInput(arxivAbstractTerms),
      authors: splitStructuredInput(arxivAuthors),
      categories: arxivCategories,
      comments_terms: splitStructuredInput(arxivCommentsTerms),
      journal_ref_terms: splitStructuredInput(arxivJournalTerms),
      exclude_terms: splitStructuredInput(arxivExcludeTerms),
    }),
    [
      arxivAbstractTerms,
      arxivAllTerms,
      arxivAuthors,
      arxivCategories,
      arxivCommentsTerms,
      arxivExcludeTerms,
      arxivJournalTerms,
      arxivTitleTerms,
      arxivTopic,
    ]
  );
  const arxivHasSearchTerms = useMemo(() => hasStructuredArxivTerms(arxivRequest), [arxivRequest]);
  const arxivAppliedFilters = useMemo(() => buildAppliedFilterEntries(arxivResult?.applied_filters), [arxivResult]);
  const arxivOnlyRequest = useMemo<ArxivSearchRequest>(
    () => ({
      topic: arxivOnlyTopic.trim(),
      all_terms: splitStructuredInput(arxivOnlyAllTerms),
      title_terms: splitStructuredInput(arxivOnlyTitleTerms),
      abstract_terms: splitStructuredInput(arxivOnlyAbstractTerms),
      authors: splitStructuredInput(arxivOnlyAuthors),
      categories: arxivOnlyCategories,
      comments_terms: splitStructuredInput(arxivOnlyCommentsTerms),
      journal_ref_terms: splitStructuredInput(arxivOnlyJournalTerms),
      exclude_terms: splitStructuredInput(arxivOnlyExcludeTerms),
    }),
    [
      arxivOnlyAbstractTerms,
      arxivOnlyAllTerms,
      arxivOnlyAuthors,
      arxivOnlyCategories,
      arxivOnlyCommentsTerms,
      arxivOnlyExcludeTerms,
      arxivOnlyJournalTerms,
      arxivOnlyTitleTerms,
      arxivOnlyTopic,
    ]
  );
  const arxivOnlyHasSearchTerms = useMemo(
    () => hasStructuredArxivTerms(arxivOnlyRequest),
    [arxivOnlyRequest]
  );
  const arxivOnlyAppliedFilters = useMemo(
    () => buildAppliedFilterEntries(arxivOnlyResult?.applied_filters),
    [arxivOnlyResult]
  );
  const expandedFriendSectionCount = useMemo(
    () => YANWEB_FRIEND_LINK_SECTIONS.filter((section) => openFriendSections[section.title]).length,
    [openFriendSections]
  );
  const allFriendSectionsExpanded = expandedFriendSectionCount === YANWEB_FRIEND_LINK_SECTIONS.length;

  const toggleFriendSection = (title: string) => {
    setOpenFriendSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const setAllFriendSections = (open: boolean) => {
    setOpenFriendSections(Object.fromEntries(YANWEB_FRIEND_LINK_SECTIONS.map((section) => [section.title, open])));
  };

  const revealFriendSection = (title: string, index: number) => {
    setOpenFriendSections((prev) => ({ ...prev, [title]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(friendLinkSectionId(index))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleArxivKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      void handleArxivSearch();
    }
  };

  const handleArxivSearch = async () => {
    if (!arxivHasSearchTerms || arxivLoading) return;
    const now = Date.now();
    if (now - arxivLastSearchAt.current < 3000) return;
    arxivLastSearchAt.current = now;

    const days = Number(arxivDays);
    const limit = Number(arxivLimit);

    try {
      setArxivLoading(true);
      setArxivError("");
      setArxivSearched(true);
      const result = await apiClient.paperSearch.search(
        arxivRequest,
        Number.isFinite(days) ? days : 14,
        Number.isFinite(limit) ? limit : 6,
        arxivMode
      );
      setArxivResult(result);
    } catch (nextError) {
      setArxivResult(null);
      setArxivError(formatErrorMessage(nextError));
    } finally {
      setArxivLoading(false);
    }
  };

  const handleArxivOnlyKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      void handleArxivOnlySearch();
    }
  };

  const handleArxivOnlySearch = async () => {
    if (!arxivOnlyHasSearchTerms || arxivOnlyLoading) return;
    const now = Date.now();
    if (now - arxivOnlyLastSearchAt.current < 3000) return;
    arxivOnlyLastSearchAt.current = now;

    const days = Number(arxivOnlyDays);
    const limit = Number(arxivOnlyLimit);

    try {
      setArxivOnlyLoading(true);
      setArxivOnlyError("");
      setArxivOnlySearched(true);
      const result = await apiClient.arxiv.search(
        arxivOnlyRequest,
        Number.isFinite(days) ? days : 30,
        Number.isFinite(limit) ? limit : 8,
        arxivOnlyMode
      );
      setArxivOnlyResult(result);
    } catch (nextError) {
      setArxivOnlyResult(null);
      setArxivOnlyError(formatErrorMessage(nextError));
    } finally {
      setArxivOnlyLoading(false);
    }
  };

  const handleSourceLookup = async () => {
    const trimmed = sourceQuery.trim();
    if (!trimmed || sourceLoading) return;

    try {
      setSourceLoading(true);
      setSourceSearched(true);
      setSourceError("");
      const result = await apiClient.sources.lookup(trimmed, 10);
      setSourceSections(result.sections ?? []);
    } catch (nextError) {
      setSourceSections([]);
      setSourceError(formatErrorMessage(nextError));
    } finally {
      setSourceLoading(false);
    }
  };

  const handleMdFormat = async () => {
    const text = mdInput.trim();
    if (!text || mdProcessing) return;

    // 按段落边界分块，每块不超过 1500 字
    const paragraphs = text.split(/\n{2,}/);
    const chunks: string[] = [];
    let cur = "";
    for (const para of paragraphs) {
      if (cur.length + para.length > 1500 && cur) {
        chunks.push(cur.trim());
        cur = para;
      } else {
        cur = cur ? `${cur}\n\n${para}` : para;
      }
    }
    if (cur.trim()) chunks.push(cur.trim());

    setMdProcessing(true);
    setMdError("");
    setMdResult("");
    setMdProgress({ current: 0, total: chunks.length });

    let styleSummary = "";
    const parts: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        setMdProgress({ current: i + 1, total: chunks.length });
        const { formatted, styleSummary: nextSummary } = await apiClient.markdown.formatChunk(
          chunks[i],
          styleSummary,
        );
        parts.push(formatted);
        styleSummary = nextSummary;
      }
      setMdResult(parts.join("\n\n"));
    } catch (err) {
      setMdError(formatErrorMessage(err));
    } finally {
      setMdProcessing(false);
      setMdProgress(null);
    }
  };

  const handleMdUpload = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      filters: [{ name: "文本文件", extensions: ["md", "txt"] }],
      multiple: false,
    });
    if (typeof path === "string") {
      const content = await readTextFile(path);
      setMdInput(content);
    }
  };

  const handleMdSave = async () => {
    if (!mdResult) return;
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: "formatted.md",
    });
    if (path) {
      await writeTextFile(path, mdResult);
    }
  };

  const handleTranslate = async () => {
    const text = translateInput.trim();
    if (!text || translateLoading) return;
    setTranslateLoading(true);
    setTranslateError("");
    setTranslateResult("");
    try {
      const result = await apiClient.translate.translate(
        text,
        translateTargetLang,
        translateSourceLang === "auto" ? undefined : translateSourceLang,
      );
      setTranslateResult(result);
    } catch (err) {
      setTranslateError(formatErrorMessage(err));
    } finally {
      setTranslateLoading(false);
    }
  };

  const resetPptDocument = () => {
    setPptDocName(null);
    setPptDocContent(null);
    setPptDocError("");
    setPptDocLoading(false);
  };

  const loadPptDocument = async (name: string, loader: () => Promise<string>) => {
    setPptDocName(name);
    setPptDocLoading(true);
    setPptDocContent(null);
    setPptDocError("");
    try {
      const text = await loader();
      setPptDocContent(text);
    } catch (err) {
      setPptDocContent(null);
      setPptDocError(formatErrorMessage(err));
    } finally {
      setPptDocLoading(false);
    }
  };

  const handlePptDocumentDrop = async (file: File) => {
    const droppedFile = file as File & { path?: string };
    if (file.name.toLowerCase().endsWith(".pdf")) {
      if (!droppedFile.path) {
        setPptDocName(file.name);
        setPptDocContent(null);
        setPptDocError("拖拽的 PDF 无法获取本地路径，请使用“本地文件”按钮选择 PDF。");
        setPptDocLoading(false);
        return;
      }
      await loadPptDocument(file.name, () => apiClient.papers.extractPdfText(droppedFile.path as string));
      return;
    }

    await loadPptDocument(file.name, () => file.text());
  };

  const handlePptDocumentPick = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({
      filters: [{ name: "文档", extensions: ["pdf", "txt", "md"] }],
      multiple: false,
    });
    if (typeof path !== "string") return;

    const name = path.split("/").pop() ?? path;
    if (name.toLowerCase().endsWith(".pdf")) {
      await loadPptDocument(name, () => apiClient.papers.extractPdfText(path));
      return;
    }

    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    await loadPptDocument(name, () => readTextFile(path));
  };

  const handlePptGenerate = async () => {
    if (pptFeatureDisabled || pptStatus === "llm" || pptStatus === "building") return;

    const JSON_SCHEMA = `{\n  "title": "演示标题",\n  "slides": [\n    { "layout": "title", "title": "主标题", "subtitle": "副标题" },\n    { "layout": "section", "title": "章节名", "subtitle": "章节说明（可选）" },\n    { "layout": "content", "title": "幻灯片标题", "bullets": ["要点1", "要点2", "要点3"] },\n    { "layout": "two_column", "title": "对比标题", "left": ["左侧1", "左侧2"], "right": ["右侧1", "右侧2"] }\n  ]\n}`;

    const LANG_MAP: Record<string, string> = {
      auto: "语言根据主题自动决定（中文主题用中文，英文主题用英文）",
      zh: "全程使用中文",
      en: "全 content in English",
    };

    const effectivePptStyle = pptStyle === "custom" ? pptCustomStyle.trim() : pptStyle;
    const effectivePptPages = pptPages === "custom" ? pptCustomPages.trim() : pptPages;
    const customPageCount = Number.parseInt(effectivePptPages, 10);
    const styleHint = effectivePptStyle === "auto" || !effectivePptStyle
      ? "根据科研主题与内容深度自行判断最合适的学术风格"
      : `${effectivePptStyle}风格`;
    const langHint = LANG_MAP[pptLang] ?? LANG_MAP.auto;
    const pageHint = effectivePptPages === "auto" || !Number.isFinite(customPageCount)
      ? "页数由小妍根据内容深度自动决定（建议 10～16 页）"
      : `总页数控制在 ${Math.min(40, Math.max(4, customPageCount))} 页左右（含标题页和致谢页）`;
    const COMMON_RULES = `\n风格：${styleHint}\n语言：${langHint}\n页数：${pageHint}\n其他规则：\n- layout 只能是 title / section / content / two_column\n- 第一页固定 title 布局，最后一页用 title 布局作为致谢页\n- 包含 2～3 个 section 分隔页\n- bullets 每条不超过 20 字，最多 5 条\n- two_column 用于对比或并列内容`;

    let prompt = "";
    if (pptMode === "topic") {
      if (!pptTopic.trim()) return;
      prompt = `请为演示主题"${pptTopic.trim()}"生成幻灯片数据。\n\n只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明，格式严格如下：\n${JSON_SCHEMA}\n${COMMON_RULES}`;
    } else if (pptMode === "outline") {
      if (!pptOutline.trim()) return;
      prompt = `请根据以下大纲生成幻灯片数据：\n\n${pptOutline.trim()}\n\n只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明，格式严格如下：\n${JSON_SCHEMA}\n${COMMON_RULES}\n- 严格按照大纲层级组织幻灯片`;
    } else {
      if (!pptDocContent || pptDocError) return;
      prompt = `请根据以下文档内容生成幻灯片数据：\n\n${pptDocContent.slice(0, 4000)}\n\n只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明，格式严格如下：\n${JSON_SCHEMA}\n${COMMON_RULES}\n- 提炼文档核心内容`;
    }

    const runId = ++pptRunIdRef.current;
    setPptStatus("llm");
    setPptBuffer(null);
    setPptSlideCount(0);
    setPptError("");

    try {
      let raw = "";
      for await (const chunk of apiClient.chat.stream({ message: prompt })) {
        if (runId !== pptRunIdRef.current) return;
        if (chunk.type === "delta") raw += chunk.value;
        else if (chunk.type === "error") throw new Error(chunk.value as string);
      }

      const jsonStr = extractJsonObject(raw);
      const data = normalizePptData(JSON.parse(jsonStr));

      if (runId !== pptRunIdRef.current) return;
      setPptStatus("building");
      const buffer = await buildPptx(data);
      if (runId !== pptRunIdRef.current) return;
      setPptSlideCount(data.slides.length);
      setPptBuffer(buffer);
      setPptFileBaseName(sanitizePptFileName(data.title));
      setPptStatus("ready");
    } catch (err) {
      if (runId !== pptRunIdRef.current) return;
      setPptError(formatErrorMessage(err));
      setPptStatus("error");
    }
  };

  const handlePptDownload = async () => {
    if (!pptBuffer) return;
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const defaultName = `${pptFileBaseName}.pptx`;
    const path = await save({ filters: [{ name: "PowerPoint", extensions: ["pptx"] }], defaultPath: defaultName });
    if (path) await writeFile(path, new Uint8Array(pptBuffer));
  };

  const TABS = [
    { key: "arxiv" as const, icon: <Sparkles className="h-4 w-4" />, label: "论文检索" },
    { key: "source" as const, icon: <FileSearch className="h-4 w-4" />, label: "刊会查询" },
    { key: "translate" as const, icon: <Languages className="h-4 w-4" />, label: "学术翻译" },
    { key: "md" as const, icon: <FileText className="h-4 w-4" />, label: "MD 整理" },
    { key: "ppt" as const, icon: <Presentation className="h-4 w-4" />, label: "生成 PPT" },
    { key: "links" as const, icon: <Globe2 className="h-4 w-4" />, label: "科研友链" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-ink-primary">实用工具</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          小妍为你准备了一批科研实用工具，涵盖论文检索、期刊查询、工具生成等场景。
        </p>
      </div>

      <div className="shrink-0 px-6 pb-3">
        <div
          className="inline-flex rounded-2xl p-1 gap-0.5"
          style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
              style={
                activeTab === tab.key
                  ? { background: "var(--rc-elevated)", boxShadow: raisedShadow, color: "var(--rc-text)" }
                  : { color: "var(--rc-text-muted)" }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">

      {activeTab === "arxiv" && <>
      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Globe2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-primary">论文检索</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              小妍会联网检索全网论文，并按相关性与研究价值做聚合排序，帮你快速定位值得读的工作。
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-apple-blue/15 bg-apple-blue/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-apple-blue" />
            <div>
              <p className="text-sm font-semibold text-ink-primary">论文智能检索模块</p>
              <p className="mt-1 text-xs leading-5 text-ink-tertiary">
                支持关键词、标题、摘要、作者、排除词组合检索；同一字段内多个词按 OR 合并，不同字段按 AND 组合。
              </p>
            </div>
          </div>
        </div>

        <Textarea
          value={arxivTopic}
          onChange={(event) => setArxivTopic(event.target.value)}
          onKeyDown={handleArxivKeyDown}
          rows={2}
          placeholder="例如：LLM, diffusion, reinforcement learning…"
          label="研究主题说明（可选，小妍根据你的输入自动优化检索策略）"
        />

        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink-tertiary ml-1">
            检索词<span className="text-apple-red ml-0.5">*</span>
            <span className="font-normal ml-1">（通用、标题、摘要、作者、扩展词中至少填写一项）</span>
          </p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            value={arxivAllTerms}
            onChange={(event) => setArxivAllTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：model memory, tool use"
            label="通用关键词"
          />
          <Input
            value={arxivTitleTerms}
            onChange={(event) => setArxivTitleTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：planning, memory"
            label="标题关键词"
          />
          <Input
            value={arxivAbstractTerms}
            onChange={(event) => setArxivAbstractTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：benchmark, long-term"
            label="摘要关键词"
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Input
            value={arxivAuthors}
            onChange={(event) => setArxivAuthors(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：Geoffrey Hinton, Percy Liang"
            label="作者"
          />
          <Input
            value={arxivCommentsTerms}
            onChange={(event) => setArxivCommentsTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：code, benchmark, workshop"
            label="扩展关键词"
          />
          <Input
            value={arxivExcludeTerms}
            onChange={(event) => setArxivExcludeTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：robotics, medical imaging"
            label="排除词"
          />
        </div>
        </div>

        {/* 三步级联筛选：研究领域 × 类型 × 等级 */}
        <div className="rounded-2xl p-4 space-y-4" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-tertiary tracking-wide">
                步骤 1 · 研究领域
                <span className="font-normal ml-1">（可多选）</span>
              </label>
              {venueFilterDomains.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setVenueFilterDomains([]); setVenueFilterRanks([]); }}
                  className="text-[11px] text-ink-tertiary hover:text-apple-red transition-colors"
                >
                  清空筛选
                </button>
              )}
            </div>

            {/* 计算机科学：两级分类 */}
            <div className="rounded-xl p-2.5 space-y-2" style={{ background: "var(--rc-elevated)", boxShadow: insetShadow }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary px-0.5">计算机科学</p>
              {CS_GROUPS.map((group) => {
                const groupKeys = group.keys;
                const allSel = groupKeys.every((k) => venueFilterDomains.includes(k));
                const someSel = groupKeys.some((k) => venueFilterDomains.includes(k));
                return (
                  <div key={group.label} className="flex items-center gap-1.5 flex-wrap">
                    {/* 一级：分组标签，点击全选/全取消该组 */}
                    <button
                      type="button"
                      onClick={() =>
                        setVenueFilterDomains((prev) =>
                          allSel
                            ? prev.filter((k) => !groupKeys.includes(k))
                            : [...new Set([...prev, ...groupKeys])]
                        )
                      }
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold shrink-0 transition-all duration-100 active:scale-95"
                      style={
                        allSel
                          ? { background: "#0062CC", color: "#fff" }
                          : someSel
                          ? { background: "rgba(0,122,255,0.15)", color: "var(--apple-blue,#007AFF)", border: "1px solid rgba(0,122,255,0.3)" }
                          : { background: "var(--rc-surface)", color: "var(--rc-text-muted)", boxShadow: raisedShadow }
                      }
                    >
                      {group.label}
                    </button>
                    <span className="text-ink-tertiary" style={{ fontSize: 10 }}>›</span>
                    {/* 二级：子领域 chip */}
                    {groupKeys.map((key) => {
                      const d = DOMAIN_VENUES[key];
                      const sel = venueFilterDomains.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setVenueFilterDomains((prev) =>
                              sel ? prev.filter((k) => k !== key) : [...prev, key]
                            )
                          }
                          className="px-2.5 py-1 rounded-xl text-xs font-medium transition-all duration-100 active:scale-95"
                          style={
                            sel
                              ? { background: "linear-gradient(145deg,#1A8AFF,#0062CC)", color: "#fff", boxShadow: "2px 2px 6px rgba(0,62,204,0.3)" }
                              : { background: "var(--rc-surface)", color: "var(--rc-text-soft)", boxShadow: raisedShadow }
                          }
                        >
                          {d?.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* 非 CS 领域：平铺 */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary px-0.5">其他领域</p>
              <div className="flex flex-wrap gap-1.5">
                {NON_CS_KEYS.map((key) => {
                  const d = DOMAIN_VENUES[key];
                  const sel = venueFilterDomains.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setVenueFilterDomains((prev) =>
                          sel ? prev.filter((k) => k !== key) : [...prev, key]
                        )
                      }
                      className="px-2.5 py-1 rounded-xl text-xs font-medium transition-all duration-100 active:scale-95"
                      style={
                        sel
                          ? { background: "linear-gradient(145deg,#1A8AFF,#0062CC)", color: "#fff", boxShadow: "2px 2px 6px rgba(0,62,204,0.3)" }
                          : { background: "var(--rc-elevated)", color: "var(--rc-text-soft)", boxShadow: raisedShadow }
                      }
                    >
                      {d?.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2 + 3：仅当选了领域后展示 */}
          {venueFilterDomains.length > 0 && (
            <>
              {/* Step 2 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink-tertiary tracking-wide">步骤 2 · 类型</label>
                <div
                  className="inline-flex rounded-xl p-0.5 gap-0.5"
                  style={{ background: "var(--rc-elevated)", boxShadow: insetShadow }}
                >
                  {(["all","conference","journal"] as const).map((t) => {
                    const lbl = t === "all" ? "全部" : t === "conference" ? "会议" : "期刊";
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setVenueFilterType(t)}
                        className="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                        style={
                          venueFilterType === t
                            ? { background: "var(--rc-surface)", color: "var(--rc-text)", boxShadow: raisedShadow }
                            : { color: "var(--rc-text-muted)" }
                        }
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink-tertiary tracking-wide">
                  步骤 3 · 等级
                  <span className="font-normal ml-1">（可多选）</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RANK_OPTIONS.map(({ key, label, color }) => {
                    const sel = venueFilterRanks.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setVenueFilterRanks((prev) =>
                            sel ? prev.filter((k) => k !== key) : [...prev, key]
                          )
                        }
                        className="px-2.5 py-1 rounded-xl text-xs font-semibold transition-all duration-100 active:scale-95"
                        style={
                          sel
                            ? { background: color, color: "#fff", boxShadow: `0 2px 6px ${color}55` }
                            : { background: `${color}15`, color: color, border: `1px solid ${color}40` }
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 结果摘要 */}
          {venueFilterDomains.length > 0 && venueFilterRanks.length > 0 && (() => {
            const { categories, journalTerms: staticTerms } = computeStaticVenues(venueFilterDomains, venueFilterType, venueFilterRanks);
            const totalTerms = new Set([...staticTerms, ...dynamicJournalTerms]).size;
            return (
              <p className="text-[11px] text-ink-tertiary flex items-center gap-1.5">
                {venueFilterLoading
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> 正在从本地数据库加载期刊列表…</>
                  : <>已匹配 <span className="font-semibold text-apple-blue">{totalTerms}</span> 个会议/期刊
                    {categories.length > 0 && <>，<span className="font-semibold text-apple-blue">{categories.length}</span> 个 arXiv 分类</>}</>
                }
              </p>
            );
          })()}

          {/* 空提示 */}
          {venueFilterDomains.length === 0 && (
            <p className="text-[11px] text-ink-tertiary">选择领域后，继续选择类型和等级，自动填充期刊/会议检索范围。</p>
          )}
          {venueFilterDomains.length > 0 && venueFilterRanks.length === 0 && (
            <p className="text-[11px] text-ink-tertiary">请在步骤 3 选择至少一个等级以确定检索范围。</p>
          )}
        </div>

        <p className="text-xs leading-5 text-ink-tertiary">
          检索会结合最近时间窗口，并对候选论文做相关性和质量信号排序。
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="最近天数"
            type="number"
            min={1}
            max={365}
            value={arxivDays}
            onChange={(event) => setArxivDays(event.target.value)}
            placeholder="14"
          />
          <Input
            label="返回篇数"
            type="number"
            min={1}
            max={20}
            value={arxivLimit}
            onChange={(event) => setArxivLimit(event.target.value)}
            placeholder="6"
          />
          <div className="w-full">
            <label className="block text-xs font-medium text-ink-tertiary mb-1.5 ml-1">排序方式</label>
            <div
              className="inline-flex w-full rounded-2xl p-1 gap-0.5"
              style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
            >
              {ARXIV_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setArxivMode(option.value)}
                  className="flex-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150"
                  style={
                    arxivMode === option.value
                      ? { background: "var(--rc-elevated)", boxShadow: raisedShadow, color: "var(--rc-text)" }
                      : { color: "var(--rc-text-muted)" }
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs leading-5 text-ink-tertiary">
            当前模式：<span className="font-medium text-ink-secondary">{currentMode.label}</span>
            {`，${currentMode.description}`}
          </p>
          <Button onClick={() => void handleArxivSearch()} loading={arxivLoading} disabled={!arxivHasSearchTerms}>
            <FileSearch className="h-4 w-4" />
            联网检索论文
          </Button>
        </div>

        {arxivError && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{arxivError}</span>
          </div>
        )}
      </Card>

      {arxivResult ? (
        <div className="space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{arxivResult.ranking_mode === "quality" ? "质量预测" : "最相关"}</Badge>
              <Badge variant={arxivResult.llm_used ? "success" : "warning"}>
                {arxivResult.llm_used ? "已使用当前模型设置" : "模型未启用，已降级启发式排序"}
              </Badge>
              <Badge variant="default">{`候选 ${arxivResult.candidate_count} 篇`}</Badge>
              <Badge variant="default">{`返回 ${arxivResult.papers.length} 篇`}</Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-primary">{arxivResult.overall_summary}</p>
              <p className="text-sm leading-6 text-ink-secondary">{arxivResult.ranking_note}</p>
              <p className="text-xs leading-5 text-ink-tertiary">{arxivResult.disclaimer}</p>
            </div>

            {arxivAppliedFilters.length > 0 ? (
              <div className="space-y-2 rounded-2xl bg-white/40 px-3 py-3">
                <p className="text-xs font-semibold text-ink-secondary">本次检索条件</p>
                <div className="flex flex-wrap gap-2">
                  {arxivAppliedFilters.flatMap((entry) =>
                    entry.values.map((value) => (
                      <Badge key={`${entry.label}-${value}`} variant="default">
                        {`${entry.label}：${value}`}
                      </Badge>
                    ))
                  )}
                </div>
                <p className="text-[11px] leading-5 text-ink-tertiary">本次查询表达式</p>
                <p className="break-all rounded-2xl bg-white/55 px-3 py-2 font-mono text-[11px] leading-5 text-ink-tertiary">
                  {arxivResult.search_expression}
                </p>
              </div>
            ) : null}
          </Card>

          {arxivResult.papers.length > 0 ? (
            <div className="space-y-3">
              {arxivResult.papers.map((paper, index) => (
                <Card key={`${paper.arxiv_id}-${index}`} padding="md" className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={scoreVariant(paper.score)}>{`${paper.score} 分`}</Badge>
                        {paper.category ? <Badge variant="default">{paper.category}</Badge> : null}
                        {paper.published_at ? (
                          <Badge variant="default">{formatDate(paper.published_at)}</Badge>
                        ) : null}
                      </div>
                      <ExternalLink
                        href={paper.abs_url}
                        className="text-base font-semibold leading-7 text-ink-primary hover:text-apple-blue hover:underline"
                      >
                        {paper.title}
                      </ExternalLink>
                      {paper.title_zh ? (
                        <p className="text-sm font-medium text-ink-secondary">{paper.title_zh}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ExternalLink
                        href={paper.abs_url}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                        title="打开论文详情页"
                      >
                        详情
                      </ExternalLink>
                      <ExternalLink
                        href={paper.pdf_url}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                        title="打开论文 PDF"
                      >
                        PDF
                      </ExternalLink>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs leading-5 text-ink-tertiary">{paper.authors || "作者信息缺失"}</p>
                    {paper.tldr_zh ? (
                      <p className="rounded-2xl bg-white/45 px-3 py-2 text-sm leading-6 text-ink-secondary">
                        {paper.tldr_zh}
                      </p>
                    ) : null}
                    <p className="text-sm leading-6 text-ink-secondary">{paper.reason}</p>
                    <p className="text-sm leading-6 text-ink-tertiary">{truncateText(paper.abstract_text)}</p>
                  </div>

                  {paper.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {paper.tags.map((tag) => (
                        <Badge key={`${paper.arxiv_id}-${tag}`} variant="default">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays className="h-8 w-8 text-ink-tertiary" />
              <div>
                <p className="font-medium text-ink-secondary">当前条件下没有匹配论文</p>
                <p className="mt-1 text-sm text-ink-tertiary">
                  建议增加最近天数，或放宽标题词、摘要词和领域标签条件。
                </p>
              </div>
            </Card>
          )}
        </div>
      ) : arxivSearched && !arxivLoading && !arxivError ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">暂无结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">检查检索字段和时间窗口后重试。</p>
          </div>
        </Card>
      ) : null}

      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-primary">arXiv 智能检索</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              arXiv 是全球最早且规模最大的学术预印本开放仓储，1991 年由物理学家 Paul Ginsparg 创立，现由康奈尔大学图书馆运营。小妍会帮你按官方字段拆分检索式：同一字段内多个值按 OR 合并，不同字段按 AND 组合，排除词走 ANDNOT。
            </p>
          </div>
        </div>

        <Textarea
          value={arxivOnlyTopic}
          onChange={(event) => setArxivOnlyTopic(event.target.value)}
          onKeyDown={handleArxivOnlyKeyDown}
          rows={2}
          placeholder="例如：LLM, diffusion, reinforcement learning…"
          label="研究主题说明（可选，小妍根据你的输入自动优化检索策略）"
        />

        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink-tertiary ml-1">
            检索词<span className="text-apple-red ml-0.5">*</span>
            <span className="font-normal ml-1">（通用、标题、摘要、作者、备注、期刊词中至少填写一项）</span>
          </p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            value={arxivOnlyAllTerms}
            onChange={(event) => setArxivOnlyAllTerms(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：model memory, tool use"
            label="通用关键词（all）"
          />
          <Input
            value={arxivOnlyTitleTerms}
            onChange={(event) => setArxivOnlyTitleTerms(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：planning, memory"
            label="标题关键词（ti）"
          />
          <Input
            value={arxivOnlyAbstractTerms}
            onChange={(event) => setArxivOnlyAbstractTerms(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：benchmark, long-term"
            label="摘要关键词（abs）"
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Input
            value={arxivOnlyAuthors}
            onChange={(event) => setArxivOnlyAuthors(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：Geoffrey Hinton, Percy Liang"
            label="作者（au）"
          />

        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-tertiary ml-1">arXiv 分类（cat）</label>
          <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
            {arxivOnlyCategories.length === 0 ? (
              <span className="text-xs text-ink-tertiary">未选择分类，检索时不限分类</span>
            ) : (
              arxivOnlyCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium text-apple-blue"
                  style={{ background: "rgba(0,122,255,0.1)" }}
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => setArxivOnlyCategories((prev) => prev.filter((c) => c !== cat))}
                    className="hover:text-apple-red transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
            {arxivOnlyCategories.length > 0 && (
              <button
                type="button"
                onClick={() => setArxivOnlyCategories([])}
                className="text-[11px] text-ink-tertiary hover:text-apple-red transition-colors ml-1"
              >
                清空
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setArxivOnlyCatPickerOpen((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-medium text-apple-blue hover:opacity-75 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            {arxivOnlyCatPickerOpen ? "收起分类面板" : "展开分类面板"}
          </button>

          {arxivOnlyCatPickerOpen && (
            <div className="rounded-2xl p-3 space-y-3" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
              {ARXIV_CATEGORIES.map((group) => (
                <div key={group.domain}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary mb-1.5">
                    {group.domain}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map(({ id, zh }) => {
                      const selected = arxivOnlyCategories.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setArxivOnlyCategories((prev) =>
                              selected ? prev.filter((c) => c !== id) : [...prev, id]
                            )
                          }
                          className="flex flex-col items-start px-2.5 py-1.5 rounded-xl transition-all duration-100 active:scale-95"
                          style={
                            selected
                              ? {
                                  background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                                  color: "#FFFFFF",
                                  boxShadow: "2px 2px 6px rgba(0,62,204,0.3), -1px -1px 4px rgba(58,155,255,0.2)",
                                }
                              : {
                                  background: "var(--rc-surface)",
                                  color: "var(--rc-text-soft)",
                                  boxShadow: raisedShadow,
                                }
                          }
                        >
                          <span className="text-xs font-semibold leading-tight">{id}</span>
                          <span className="text-[10px] leading-tight mt-0.5" style={{ opacity: selected ? 0.8 : 0.55 }}>
                            {zh}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

          <Input
            value={arxivOnlyCommentsTerms}
            onChange={(event) => setArxivOnlyCommentsTerms(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：code, benchmark, workshop"
            label="备注关键词（co）"
          />
          <Input
            value={arxivOnlyJournalTerms}
            onChange={(event) => setArxivOnlyJournalTerms(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：ICLR, ACL, NeurIPS"
            label="期刊/会议信息（jr）"
          />
          <Input
            value={arxivOnlyExcludeTerms}
            onChange={(event) => setArxivOnlyExcludeTerms(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：robotics, medical imaging"
            label="排除词（ANDNOT）"
          />
        </div>
        </div>

        <p className="text-xs leading-5 text-ink-tertiary">
          检索时会自动加入最近时间窗口的 <span className="font-medium text-ink-secondary">submittedDate</span> 条件，多个分类之间以 OR 合并。
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="最近天数"
            type="number"
            min={1}
            max={365}
            value={arxivOnlyDays}
            onChange={(event) => setArxivOnlyDays(event.target.value)}
            placeholder="14"
          />
          <Input
            label="返回篇数"
            type="number"
            min={1}
            max={20}
            value={arxivOnlyLimit}
            onChange={(event) => setArxivOnlyLimit(event.target.value)}
            placeholder="6"
          />
          <div className="w-full">
            <label className="block text-xs font-medium text-ink-tertiary mb-1.5 ml-1">排序方式</label>
            <div className="inline-flex w-full rounded-2xl p-1 gap-0.5" style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}>
              {ARXIV_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setArxivOnlyMode(option.value)}
                  className="flex-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150"
                  style={
                    arxivOnlyMode === option.value
                      ? { background: "var(--rc-elevated)", boxShadow: raisedShadow, color: "var(--rc-text)" }
                      : { color: "var(--rc-text-muted)" }
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs leading-5 text-ink-tertiary">
            当前模式：<span className="font-medium text-ink-secondary">{(ARXIV_MODE_OPTIONS.find((m) => m.value === arxivOnlyMode) ?? ARXIV_MODE_OPTIONS[0]).label}</span>
            {`，${(ARXIV_MODE_OPTIONS.find((m) => m.value === arxivOnlyMode) ?? ARXIV_MODE_OPTIONS[0]).description}`}
          </p>
          <Button onClick={() => void handleArxivOnlySearch()} loading={arxivOnlyLoading} disabled={!arxivOnlyHasSearchTerms}>
            <FileSearch className="h-4 w-4" />
            检索 arXiv
          </Button>
        </div>

        {arxivOnlyError && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{arxivOnlyError}</span>
          </div>
        )}
      </Card>

      {arxivOnlyResult ? (
        <div className="space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{arxivOnlyResult.ranking_mode === "quality" ? "质量预测" : "最相关"}</Badge>
              <Badge variant={arxivOnlyResult.llm_used ? "success" : "warning"}>
                {arxivOnlyResult.llm_used ? "已使用当前模型设置" : "模型未启用，已降级启发式排序"}
              </Badge>
              <Badge variant="default">{`候选 ${arxivOnlyResult.candidate_count} 篇`}</Badge>
              <Badge variant="default">{`返回 ${arxivOnlyResult.papers.length} 篇`}</Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-primary">{arxivOnlyResult.overall_summary}</p>
              <p className="text-sm leading-6 text-ink-secondary">{arxivOnlyResult.ranking_note}</p>
              <p className="text-xs leading-5 text-ink-tertiary">{arxivOnlyResult.disclaimer}</p>
            </div>

            {arxivOnlyAppliedFilters.length > 0 ? (
              <div className="space-y-2 rounded-2xl bg-white/40 px-3 py-3">
                <p className="text-xs font-semibold text-ink-secondary">本次检索条件</p>
                <div className="flex flex-wrap gap-2">
                  {arxivOnlyAppliedFilters.flatMap((entry) =>
                    entry.values.map((value) => (
                      <Badge key={`${entry.label}-${value}`} variant="default">
                        {`${entry.label}：${value}`}
                      </Badge>
                    ))
                  )}
                </div>
                <p className="text-[11px] leading-5 text-ink-tertiary">官方 arXiv 查询式</p>
                <p className="break-all rounded-2xl bg-white/55 px-3 py-2 font-mono text-[11px] leading-5 text-ink-tertiary">
                  {arxivOnlyResult.search_expression}
                </p>
              </div>
            ) : null}
          </Card>

          {arxivOnlyResult.papers.length > 0 ? (
            <div className="space-y-3">
              {arxivOnlyResult.papers.map((paper, index) => (
                <Card key={`${paper.arxiv_id}-${index}`} padding="md" className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={scoreVariant(paper.score)}>{`${paper.score} 分`}</Badge>
                        {paper.category ? <Badge variant="default">{paper.category}</Badge> : null}
                        {paper.published_at ? (
                          <Badge variant="default">{formatDate(paper.published_at)}</Badge>
                        ) : null}
                      </div>
                      <ExternalLink
                        href={paper.abs_url}
                        className="text-base font-semibold leading-7 text-ink-primary hover:text-apple-blue hover:underline"
                      >
                        {paper.title}
                      </ExternalLink>
                      {paper.title_zh ? <p className="text-sm font-medium text-ink-secondary">{paper.title_zh}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ExternalLink
                        href={paper.abs_url}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                        title="打开 arXiv 摘要页"
                      >
                        abs
                      </ExternalLink>
                      <ExternalLink
                        href={paper.pdf_url}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-apple-blue"
                        title="打开 arXiv PDF"
                      >
                        pdf
                      </ExternalLink>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs leading-5 text-ink-tertiary">{paper.authors || "作者信息缺失"}</p>
                    {paper.tldr_zh ? (
                      <p className="rounded-2xl bg-white/45 px-3 py-2 text-sm leading-6 text-ink-secondary">
                        {paper.tldr_zh}
                      </p>
                    ) : null}
                    <p className="text-sm leading-6 text-ink-secondary">{paper.reason}</p>
                    <p className="text-sm leading-6 text-ink-tertiary">{truncateText(paper.abstract_text)}</p>
                  </div>

                  {paper.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {paper.tags.map((tag) => (
                        <Badge key={`${paper.arxiv_id}-${tag}`} variant="default">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays className="h-8 w-8 text-ink-tertiary" />
              <div>
                <p className="font-medium text-ink-secondary">当前条件下没有匹配论文</p>
                <p className="mt-1 text-sm text-ink-tertiary">建议增加最近天数，或放宽标题词、摘要词和分类条件。</p>
              </div>
            </Card>
          )}
        </div>
      ) : arxivOnlySearched && !arxivOnlyLoading && !arxivOnlyError ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">暂无结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">检查检索字段和时间窗口后重试。</p>
          </div>
        </Card>
      ) : null}
      </>}

      {activeTab === "source" ? (
        <SourceLookupPanel
          query={sourceQuery}
          sections={sourceSections}
          loading={sourceLoading}
          error={sourceError}
          searched={sourceSearched}
          onQueryChange={setSourceQuery}
          onSubmit={handleSourceLookup}
        />
      ) : null}

      {activeTab === "translate" ? (
        <TranslationPanel
          input={translateInput}
          result={translateResult}
          loading={translateLoading}
          error={translateError}
          sourceLang={translateSourceLang}
          targetLang={translateTargetLang}
          onInputChange={setTranslateInput}
          onSourceLangChange={setTranslateSourceLang}
          onTargetLangChange={setTranslateTargetLang}
          onSubmit={handleTranslate}
        />
      ) : null}

      {activeTab === "md" ? (
        <MarkdownFormatterPanel
          input={mdInput}
          result={mdResult}
          processing={mdProcessing}
          error={mdError}
          progress={mdProgress}
          onInputChange={setMdInput}
          onUpload={handleMdUpload}
          onSubmit={handleMdFormat}
          onSave={handleMdSave}
        />
      ) : null}

      {activeTab === "ppt" ? (
        <PptWorkspace
          featureDisabled={pptFeatureDisabled}
          mode={pptMode}
          topic={pptTopic}
          outline={pptOutline}
          documentName={pptDocName}
          documentLoading={pptDocLoading}
          documentError={pptDocError}
          hasDocumentContent={Boolean(pptDocContent)}
          styleValue={pptStyle}
          customStyle={pptCustomStyle}
          language={pptLang}
          pageCount={pptPages}
          customPages={pptCustomPages}
          status={pptStatus}
          slideCount={pptSlideCount}
          error={pptError}
          onModeChange={setPptMode}
          onTopicChange={setPptTopic}
          onOutlineChange={setPptOutline}
          onDocumentDrop={handlePptDocumentDrop}
          onPickDocument={handlePptDocumentPick}
          onResetDocument={resetPptDocument}
          onStyleChange={setPptStyle}
          onCustomStyleChange={setPptCustomStyle}
          onLanguageChange={setPptLang}
          onPageCountChange={setPptPages}
          onCustomPagesChange={setPptCustomPages}
          onGenerate={handlePptGenerate}
          onDownload={handlePptDownload}
        />
      ) : null}

      {activeTab === "links" && <>
      <Card padding="md" className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Globe2 className="h-5 w-5" />
          </div>
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary">科研友链</p>
            <p className="text-xs text-ink-tertiary">{`共 ${YANWEB_FRIEND_LINK_TOTAL} 条 · ${YANWEB_FRIEND_LINK_SECTIONS.length} 个分类`}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAllFriendSections(!allFriendSectionsExpanded)}
              className="inline-flex items-center rounded-full bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
            >
              {allFriendSectionsExpanded ? "收起全部" : "展开全部"}
            </button>
          </div>
        </div>

        {<>
        <div className="flex flex-wrap gap-2">
          {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
            <button
              type="button"
              key={section.title}
              onClick={() => revealFriendSection(section.title, index)}
              className="inline-flex items-center gap-2 rounded-full bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-white/70 hover:text-apple-blue"
              aria-expanded={openFriendSections[section.title] ?? false}
              aria-controls={friendLinkSectionId(index)}
            >
              <span>{section.title}</span>
              <span className="text-ink-tertiary">{section.items.length}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => (
            <section
              key={section.title}
              id={friendLinkSectionId(index)}
              className="scroll-mt-6 overflow-hidden rounded-3xl border border-white/55 bg-white/25"
              style={{ boxShadow: "var(--rc-inset-shadow)" }}
            >
              <button
                type="button"
                onClick={() => toggleFriendSection(section.title)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/20"
                aria-expanded={openFriendSections[section.title] ?? false}
                aria-controls={`${friendLinkSectionId(index)}-panel`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-primary">{section.title}</p>
                  <Badge variant="default">{`${section.items.length} 条`}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-tertiary">
                  <span>{openFriendSections[section.title] ? "收起" : "展开"}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      openFriendSections[section.title] ? "rotate-180 text-apple-blue" : ""
                    }`}
                  />
                </div>
              </button>

              {openFriendSections[section.title] ? (
                <div id={`${friendLinkSectionId(index)}-panel`} className="border-t border-white/55 px-1 pb-1 pt-3">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {section.items.map((item) => (
                      <ExternalLink
                        key={`${section.title}-${item.name}-${item.href}`}
                        href={item.href}
                        title={`${item.name} · ${item.href}`}
                        className="group flex items-center gap-3 rounded-2xl bg-white/45 px-3 py-3 transition hover:bg-white/70"
                      >
                        <div
                          className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold text-ink-secondary transition-transform duration-150 group-hover:-translate-y-0.5"
                          style={{ background: "var(--rc-elevated)", boxShadow: raisedShadow }}
                        >
                          <span
                            className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
                            style={{ opacity: item.icon ? 0 : 1 }}
                          >
                            {friendLinkInitial(item.name)}
                          </span>
                          <img
                            src={item.icon}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="relative h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.opacity = "0";
                              const fallback = event.currentTarget.parentElement?.querySelector("span");
                              if (fallback instanceof HTMLElement) {
                                fallback.style.opacity = "1";
                              }
                            }}
                          />
                        </div>
                        <span className="min-w-0 text-sm leading-5 text-ink-primary group-hover:text-apple-blue group-hover:underline">
                          {item.name}
                        </span>
                      </ExternalLink>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
        </>}
      </Card>
      </>}

      </div>
    </div>
  );
}
