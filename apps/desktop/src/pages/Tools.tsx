import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, AlignLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Download, FileSearch, FileText, Globe2, Languages, Loader2, Presentation, Plus, Search, Sparkles, Upload, Wand2, X } from "lucide-react";
import PptxGenJS from "pptxgenjs";
import { Badge, Button, Card, Input, Textarea } from "@research-copilot/ui";
import type { ArxivRankingMode, ArxivSearchRequest, ArxivSearchResponse, Skill, SourceLookupSection } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, WosIndexBadge, VenueTypeBadge } from "../components/CcfBadges";
import ExternalLink from "../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../lib/client";
import { Link } from "react-router-dom";
import { YANWEB_FRIEND_LINK_SECTIONS, YANWEB_FRIEND_LINK_TOTAL } from "../lib/yanweb-links";

const insetShadow = "var(--rc-inset-shadow)";
const raisedShadow = "var(--rc-raised-shadow)";

const ARXIV_CATEGORIES: Array<{ domain: string; items: Array<{ id: string; zh: string }> }> = [
  {
    domain: "CS · 人工智能 & 机器学习",
    items: [
      { id: "cs.AI",  zh: "人工智能" },
      { id: "cs.LG",  zh: "机器学习" },
      { id: "cs.CL",  zh: "计算语言学" },
      { id: "cs.CV",  zh: "计算机视觉" },
      { id: "cs.NE",  zh: "神经与进化计算" },
      { id: "cs.IR",  zh: "信息检索" },
      { id: "cs.MA",  zh: "多智能体系统" },
    ],
  },
  {
    domain: "CS · 系统 & 工程",
    items: [
      { id: "cs.RO",  zh: "机器人学" },
      { id: "cs.SE",  zh: "软件工程" },
      { id: "cs.DB",  zh: "数据库" },
      { id: "cs.DC",  zh: "分布式与并行计算" },
      { id: "cs.CR",  zh: "密码学与安全" },
      { id: "cs.NI",  zh: "网络与互联网" },
      { id: "cs.HC",  zh: "人机交互" },
      { id: "cs.SY",  zh: "系统与控制" },
      { id: "cs.PL",  zh: "程序设计语言" },
      { id: "cs.DS",  zh: "数据结构与算法" },
    ],
  },
  {
    domain: "Stat & Math",
    items: [
      { id: "stat.ML", zh: "统计机器学习" },
      { id: "stat.AP", zh: "统计应用" },
      { id: "stat.ME", zh: "统计方法论" },
      { id: "math.OC", zh: "优化与控制" },
      { id: "math.NA", zh: "数值分析" },
      { id: "math.PR", zh: "概率论" },
    ],
  },
  {
    domain: "EESS & 其他",
    items: [
      { id: "eess.IV",         zh: "图像与视频处理" },
      { id: "eess.SP",         zh: "信号处理" },
      { id: "eess.AS",         zh: "音频与语音处理" },
      { id: "eess.SY",         zh: "电气系统与控制" },
      { id: "q-bio.NC",        zh: "神经元与认知" },
      { id: "physics.comp-ph", zh: "计算物理" },
    ],
  },
];

const ARXIV_MODE_OPTIONS: Array<{ value: ArxivRankingMode; label: string; description: string }> = [
  {
    value: "relevance",
    label: "最相关",
    description: "优先找和关键词最贴合、最适合当前阅读的论文。",
  },
  {
    value: "quality",
    label: "质量预测",
    description: "优先找摘要信息密度、实验信号和潜在影响更强的论文。",
  },
];

function splitStructuredInput(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[，,；;\n]/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function hasStructuredArxivTerms(request: ArxivSearchRequest) {
  return Boolean(
    request.all_terms?.length ||
      request.title_terms?.length ||
      request.abstract_terms?.length ||
      request.authors?.length ||
      request.categories?.length ||
      request.comments_terms?.length ||
      request.journal_ref_terms?.length
  );
}

function buildAppliedFilterEntries(filters?: ArxivSearchRequest | null) {
  if (!filters) return [];

  return [
    { label: "研究主题", values: filters.topic?.trim() ? [filters.topic.trim()] : [] },
    { label: "通用词(all)", values: filters.all_terms ?? [] },
    { label: "标题词(ti)", values: filters.title_terms ?? [] },
    { label: "摘要词(abs)", values: filters.abstract_terms ?? [] },
    { label: "作者(au)", values: filters.authors ?? [] },
    { label: "分类(cat)", values: filters.categories ?? [] },
    { label: "备注(co)", values: filters.comments_terms ?? [] },
    { label: "期刊/jr", values: filters.journal_ref_terms ?? [] },
    { label: "排除词", values: filters.exclude_terms ?? [] },
  ].filter((entry) => entry.values.length > 0);
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function truncateText(value: string, maxChars = 280) {
  const normalized = value.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}…`;
}

function scoreVariant(score: number) {
  if (score >= 85) return "success" as const;
  if (score >= 70) return "info" as const;
  if (score >= 55) return "warning" as const;
  return "default" as const;
}

function friendLinkSectionId(index: number) {
  return `yanweb-friend-links-${index + 1}`;
}

function friendLinkInitial(value: string) {
  return value.trim().slice(0, 1) || "?";
}

// ── PPT builder ──────────────────────────────────────────────────

type PptLayout = "title" | "section" | "content" | "two_column";

interface PptSlide {
  layout: PptLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: string[];
  right?: string[];
}

interface PptData {
  title: string;
  slides: PptSlide[];
}

function sanitizePptFileName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
  return cleaned || "slides";
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("模型未返回有效 JSON 对象。");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  throw new Error("模型返回的 JSON 不完整，请重试。");
}

function normalizePptData(input: unknown): PptData {
  if (!input || typeof input !== "object") {
    throw new Error("模型返回格式错误：缺少演示数据对象。");
  }
  const raw = input as { title?: unknown; slides?: unknown };
  if (!Array.isArray(raw.slides) || raw.slides.length === 0) {
    throw new Error("模型返回格式错误：slides 不能为空。");
  }

  const validLayouts: PptLayout[] = ["title", "section", "content", "two_column"];
  const slides: PptSlide[] = raw.slides.slice(0, 40).map((slide, idx) => {
    const source = (slide && typeof slide === "object" ? slide : {}) as Record<string, unknown>;
    const layout = (typeof source.layout === "string" && validLayouts.includes(source.layout as PptLayout)
      ? source.layout
      : "content") as PptLayout;
    const title = typeof source.title === "string" && source.title.trim() ? source.title.trim() : `第 ${idx + 1} 页`;

    const toLines = (value: unknown) =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 5)
        : undefined;

    return {
      layout,
      title,
      subtitle: typeof source.subtitle === "string" ? source.subtitle.trim() || undefined : undefined,
      bullets: toLines(source.bullets),
      left: toLines(source.left),
      right: toLines(source.right),
    };
  });

  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "演示文稿",
    slides,
  };
}

async function buildPptx(data: PptData): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33" × 7.5"

  const W = 13.33;
  const H = 7.5;
  const C = { navy: "0D1B2A", blue: "007AFF", white: "FFFFFF", text: "1A2233", soft: "3C4655", light: "F4F6F9", border: "D0D6DC" };

  for (const slide of data.slides) {
    const s = pptx.addSlide();

    if (slide.layout === "title") {
      s.background = { color: C.navy };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { type: "solid", color: C.blue, transparency: 72 } });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.18, w: W, h: 0.18, fill: { type: "solid", color: C.blue, transparency: 0 } });
      s.addText(slide.title, { x: 1.2, y: 2.3, w: W - 2.4, h: 1.6, fontSize: 42, bold: true, color: C.white, align: "center", valign: "middle" });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 1.2, y: 4.1, w: W - 2.4, h: 0.9, fontSize: 20, color: "AACCFF", align: "center" });

    } else if (slide.layout === "section") {
      s.background = { color: C.blue };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: H, fill: { type: "solid", color: C.white, transparency: 40 } });
      s.addText(slide.title, { x: 0.8, y: 2.6, w: W - 1.6, h: 1.4, fontSize: 36, bold: true, color: C.white, align: "center", valign: "middle" });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 0.8, y: 4.2, w: W - 1.6, h: 0.8, fontSize: 18, color: "DDEEFF", align: "center" });

    } else if (slide.layout === "content") {
      s.background = { color: C.light };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.25, fill: { type: "solid", color: C.navy } });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: W, h: 0.06, fill: { type: "solid", color: C.blue } });
      s.addText(slide.title, { x: 0.5, y: 0.18, w: W - 1, h: 0.9, fontSize: 26, bold: true, color: C.white, valign: "middle" });
      if (slide.bullets?.length) {
        s.addText(
          slide.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, paraSpaceAfter: 10 } })),
          { x: 0.7, y: 1.55, w: W - 1.4, h: H - 2, fontSize: 19, color: C.text, valign: "top", lineSpacingMultiple: 1.3 }
        );
      }

    } else if (slide.layout === "two_column") {
      s.background = { color: C.light };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.25, fill: { type: "solid", color: C.navy } });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: W, h: 0.06, fill: { type: "solid", color: C.blue } });
      s.addText(slide.title, { x: 0.5, y: 0.18, w: W - 1, h: 0.9, fontSize: 26, bold: true, color: C.white, valign: "middle" });
      s.addShape(pptx.ShapeType.line, { x: W / 2, y: 1.5, w: 0, h: H - 1.9, line: { color: C.border, width: 1 } });
      const colOpts = { fontSize: 18, color: C.text, valign: "top" as const, lineSpacingMultiple: 1.3 };
      if (slide.left?.length) s.addText(slide.left.map((b) => ({ text: b, options: { bullet: { code: "2022" }, paraSpaceAfter: 8 } })), { x: 0.5, y: 1.55, w: W / 2 - 0.8, h: H - 2, ...colOpts });
      if (slide.right?.length) s.addText(slide.right.map((b) => ({ text: b, options: { bullet: { code: "2022" }, paraSpaceAfter: 8 } })), { x: W / 2 + 0.3, y: 1.55, w: W / 2 - 0.8, h: H - 2, ...colOpts });
    }
  }

  return await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
}

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
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [arxivCommentsTerms, setArxivCommentsTerms] = useState("");
  const [arxivJournalTerms, setArxivJournalTerms] = useState("");
  const [arxivExcludeTerms, setArxivExcludeTerms] = useState("");
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
  const journalSection = useMemo(
    () => sourceSections.find((section) => section.key === "journal_partition"),
    [sourceSections]
  );
  const ccfSection = useMemo(
    () => sourceSections.find((section) => section.key === "ccf"),
    [sourceSections]
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
          小妍为你提供了一批科研实用工具。
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
          placeholder="例如：想找最近两周里，tool-using LLM agents 中关于 memory / planning 的代表性新文"
          label="研究主题说明（可选，小妍根据你的输入自动优化检索策略）"
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            value={arxivAllTerms}
            onChange={(event) => setArxivAllTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：agent memory, tool use"
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
          {/* 研究领域多选 */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-tertiary ml-1">研究领域标签</label>

            {/* 已选芯片 */}
            <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
              {arxivCategories.length === 0 ? (
                <span className="text-xs text-ink-tertiary">未选择领域标签，检索时不限领域</span>
              ) : (
                arxivCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium text-apple-blue"
                    style={{ background: "rgba(0,122,255,0.1)" }}
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => setArxivCategories((prev) => prev.filter((c) => c !== cat))}
                      className="hover:text-apple-red transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
              {arxivCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setArxivCategories([])}
                  className="text-[11px] text-ink-tertiary hover:text-apple-red transition-colors ml-1"
                >
                  清空
                </button>
              )}
            </div>

            {/* 展开/收起面板按钮 */}
            <button
              type="button"
              onClick={() => setCatPickerOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-apple-blue hover:opacity-75 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              {catPickerOpen ? "收起分类面板" : "展开分类面板"}
            </button>

            {/* 领域面板 */}
            {catPickerOpen && (
              <div
                className="rounded-2xl p-3 space-y-3"
                style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
              >
                {ARXIV_CATEGORIES.map((group) => (
                  <div key={group.domain}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary mb-1.5">
                      {group.domain}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map(({ id, zh }) => {
                        const selected = arxivCategories.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              setArxivCategories((prev) =>
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
                            <span
                              className="text-[10px] leading-tight mt-0.5"
                              style={{ opacity: selected ? 0.8 : 0.55 }}
                            >
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
            value={arxivCommentsTerms}
            onChange={(event) => setArxivCommentsTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：code, benchmark, workshop"
            label="扩展关键词"
          />
          <Input
            value={arxivJournalTerms}
            onChange={(event) => setArxivJournalTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：NeurIPS, ACL, Nature"
            label="期刊/会议"
          />
          <Input
            value={arxivExcludeTerms}
            onChange={(event) => setArxivExcludeTerms(event.target.value)}
            onKeyDown={handleArxivKeyDown}
            placeholder="例如：robotics, medical imaging"
            label="排除词"
          />
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
              独立 arXiv 模块，仅在 arXiv 官方数据源中检索。输入会按 arXiv 官方字段拆分：同一字段内多个值按 OR 合并，不同字段按 AND 组合，排除词走 ANDNOT。
            </p>
          </div>
        </div>

        <Textarea
          value={arxivOnlyTopic}
          onChange={(event) => setArxivOnlyTopic(event.target.value)}
          onKeyDown={handleArxivOnlyKeyDown}
          rows={2}
          placeholder="例如：想找最近两周里，tool-using LLM agents 中关于 memory / planning 的代表性新文"
          label="研究主题说明（可选，小妍根据你的输入自动优化检索策略）"
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            value={arxivOnlyAllTerms}
            onChange={(event) => setArxivOnlyAllTerms(event.target.value)}
            onKeyDown={handleArxivOnlyKeyDown}
            placeholder="例如：agent memory, tool use"
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

      {activeTab === "source" && <>
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">刊会查询</p>
            <p className="mt-1 text-xs text-ink-tertiary">请输入期刊、会议名称或 ISSN，小妍会返回分区与 CCF 评级。</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <Input
              value={sourceQuery}
              onChange={(event) => setSourceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSourceLookup();
                }
              }}
              placeholder="请输入会议、期刊名称或 ISSN"
            />
          </div>
          <Button onClick={() => void handleSourceLookup()} loading={sourceLoading} disabled={!sourceQuery.trim()}>
            <Search className="h-4 w-4" />
            查询
          </Button>
        </div>

        {sourceError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{sourceError}</span>
          </div>
        ) : null}
      </Card>

      {journalSection && journalSection.items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">{journalSection.title}</Badge>
            <p className="text-sm font-semibold text-ink-primary">WoS / JCR / 中科院</p>
          </div>
          {journalSection.items.map((item, index) => (
            <Card key={`${item.source}-${item.name}-${item.issn}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{item.name}</p>
                {item.indexes.map((indexName) => (
                  <WosIndexBadge key={`${item.name}-${indexName}`} index={indexName} />
                ))}
                <JcrQuartileBadge quartile={item.jcr_quartile} />
                <CasQuartileBadge quartile={item.cas_quartile} />
                <CasTopBadge top={item.cas_top} />
                {item.open_access ? <Badge variant="success">OA</Badge> : null}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {[item.publisher, item.issn ? `ISSN ${item.issn}` : "", item.eissn ? `eISSN ${item.eissn}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-xs leading-5 text-ink-tertiary">
                {[item.jcr_category, item.jif ? `JIF ${item.jif}` : "", item.jif_rank ? `排名 ${item.jif_rank}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {item.wos_categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.wos_categories.slice(0, 6).map((category) => (
                    <Badge key={`${item.name}-${category}`} variant="default">
                      {category}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {ccfSection && ccfSection.items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">{ccfSection.title}</Badge>
            <p className="text-sm font-semibold text-ink-primary">会议 / 期刊推荐级别</p>
          </div>
          {ccfSection.items.map((item, index) => (
            <Card key={`${item.source}-${item.name}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ExternalLink
                  href={item.url}
                  className="text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
                >
                  {item.name}
                </ExternalLink>
                <CcfRatingBadge rating={item.rating} />
                <VenueTypeBadge type={item.entity_type} />
                {item.label && <Badge variant="default">{item.label}</Badge>}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {item.area}
                {item.publisher ? ` · ${item.publisher}` : ""}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {sourceSearched && !sourceLoading && !sourceError && sourceSections.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">没有匹配结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">建议改用更完整的期刊名、会议全称或 ISSN 重试。</p>
          </div>
        </Card>
      ) : null}
      </>}

      {activeTab === "translate" && <>
      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Languages className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-ink-primary">学术翻译</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              由小妍的译衡能力驱动，优先保留专业术语和学术表达。可在设置 → 模型分工中单独配置译衡模型。
            </p>
          </div>
        </div>

        {/* 源语言 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-tertiary ml-1">原文语言</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: "auto", label: "自动识别" },
              { value: "en", label: "English" },
              { value: "zh", label: "中文" },
              { value: "ja", label: "日本語" },
              { value: "de", label: "Deutsch" },
              { value: "fr", label: "Français" },
            ].map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => setTranslateSourceLang(lang.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                style={
                  translateSourceLang === lang.value
                    ? { background: "linear-gradient(145deg,#1A8AFF,#0062CC)", color: "#fff", boxShadow: "3px 3px 8px rgba(0,62,204,0.3)" }
                    : { background: "var(--rc-surface)", color: "var(--rc-text-soft)", boxShadow: raisedShadow }
                }
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* 输入框 */}
        <Textarea
          value={translateInput}
          onChange={(e) => setTranslateInput(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void handleTranslate(); }}
          rows={6}
          placeholder="粘贴论文摘要、段落或任意学术文本…"
          label="待翻译内容"
        />

        {/* 目标语言 + 按钮 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2 flex-1">
            <p className="text-xs font-medium text-ink-tertiary ml-1">目标语言</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "zh", label: "中文" },
                { value: "en", label: "English" },
                { value: "ja", label: "日本語" },
                { value: "de", label: "Deutsch" },
                { value: "fr", label: "Français" },
              ].map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => setTranslateTargetLang(lang.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                  style={
                    translateTargetLang === lang.value
                      ? { background: "linear-gradient(145deg,#1A8AFF,#0062CC)", color: "#fff", boxShadow: "3px 3px 8px rgba(0,62,204,0.3)" }
                      : { background: "var(--rc-surface)", color: "var(--rc-text-soft)", boxShadow: raisedShadow }
                  }
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleTranslate()}
            disabled={!translateInput.trim() || translateLoading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3),-3px -3px 8px rgba(58,155,255,0.15)",
            }}
          >
            {translateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {translateLoading ? "翻译中…" : "翻译"}
          </button>
        </div>

        {translateError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{translateError}</span>
          </div>
        ) : null}
      </Card>

      {translateResult ? (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-secondary">翻译结果</p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(translateResult)}
              className="text-xs text-ink-tertiary hover:text-apple-blue transition-colors"
            >
              复制
            </button>
          </div>
          <p className="text-sm leading-7 text-ink-primary whitespace-pre-wrap">{translateResult}</p>
        </Card>
      ) : null}
      </>}

      {activeTab === "md" && <>
      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <FileText className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-ink-primary">Markdown 整理</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              将任意文本整理为规范 Markdown。内容过长时小妍会自动分块处理，每块的排版风格会以压缩提示词的形式传递给下一块，保证全文一致性，完成后小妍会直接保存为 .md 文件。
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-ink-tertiary ml-1">待整理内容</label>
            <button
              type="button"
              onClick={async () => {
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
              }}
              className="flex items-center gap-1 text-xs text-ink-tertiary hover:text-apple-blue transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              上传文件
            </button>
          </div>
          <Textarea
            value={mdInput}
            onChange={(e) => setMdInput(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void handleMdFormat(); }}
            rows={10}
            placeholder="粘贴需要整理的文字内容，或点击右上角上传 .md / .txt 文件…"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-tertiary">
            {mdInput.trim().length > 0
              ? `${mdInput.trim().length} 字 · 预计 ${Math.ceil(mdInput.trim().length / 1500)} 块`
              : "支持 ⌘/Ctrl+Enter 快捷提交"}
          </p>
          <button
            type="button"
            onClick={() => void handleMdFormat()}
            disabled={!mdInput.trim() || mdProcessing}
            className="flex items-center gap-1.5 px-5 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3),-3px -3px 8px rgba(58,155,255,0.15)",
            }}
          >
            {mdProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {mdProcessing ? "整理中…" : "开始整理"}
          </button>
        </div>

        {mdProcessing && mdProgress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-tertiary">
              <span>正在处理第 {mdProgress.current} / {mdProgress.total} 块</span>
              <span>{Math.round((mdProgress.current / mdProgress.total) * 100)}%</span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(mdProgress.current / mdProgress.total) * 100}%`,
                  background: "linear-gradient(90deg,#1A8AFF,#0062CC)",
                }}
              />
            </div>
          </div>
        ) : null}

        {mdError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{mdError}</span>
          </div>
        ) : null}
      </Card>

      {mdResult ? (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-secondary">整理结果</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(mdResult)}
                className="text-xs text-ink-tertiary hover:text-apple-blue transition-colors"
              >
                复制
              </button>
              <button
                type="button"
                onClick={() => void handleMdSave()}
                className="flex items-center gap-1 text-xs font-medium text-apple-blue hover:opacity-80 transition-opacity"
              >
                <FileText className="h-3.5 w-3.5" />
                保存为 .md
              </button>
            </div>
          </div>
          <pre
            className="text-xs leading-6 text-ink-primary whitespace-pre-wrap font-mono overflow-x-auto rounded-2xl p-4"
            style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
          >
            {mdResult}
          </pre>
        </Card>
      ) : null}
      </>}

      {activeTab === "ppt" && <>
      <div className="relative">
      <Card padding="md" className={["space-y-5", pptFeatureDisabled ? "pointer-events-none select-none opacity-40" : ""].join(" ")}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-purple/10 text-apple-purple">
            <Presentation className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-primary">幻灯片生成</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              告诉小妍你的演示主题，或上传文档、粘贴大纲，小妍会帮你生成一份结构清晰的幻灯片内容。
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div
          className="flex rounded-2xl p-1 gap-0.5"
          style={{ background: "var(--rc-surface)", boxShadow: insetShadow }}
        >
          {([
            { key: "topic" as const,    icon: <Wand2 className="h-3.5 w-3.5" />,   label: "输入主题" },
            { key: "document" as const, icon: <Upload className="h-3.5 w-3.5" />,  label: "上传文档" },
            { key: "outline" as const,  icon: <AlignLeft className="h-3.5 w-3.5" />, label: "粘贴大纲" },
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPptMode(key)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150"
              style={
                pptMode === key
                  ? { background: "var(--rc-elevated)", boxShadow: raisedShadow, color: "var(--rc-text)" }
                  : { color: "var(--rc-text-muted)" }
              }
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Input area */}
        {pptMode === "topic" && (
          <div className="space-y-2">
            <textarea
              value={pptTopic}
              onChange={(e) => setPptTopic(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void handlePptGenerate(); }}
              rows={3}
              placeholder={'输入演示主题，例如："大语言模型在科研中的应用"'}
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none"
              style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
            />
            <p className="text-xs text-ink-muted ml-1">小妍会自动决定幻灯片数量、内容深度与配图风格</p>
          </div>
        )}

        {pptMode === "document" && (
          <div>
            <div
              className="rounded-2xl border-2 border-dashed p-8 text-center space-y-4 transition-colors"
              style={{ borderColor: "var(--rc-border)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (!file) return;
                setPptDocName(file.name);
                if (file.name.toLowerCase().endsWith(".pdf")) {
                  setPptDocLoading(true);
                  try {
                    const droppedPath = (file as File & { path?: string }).path;
                    if (!droppedPath) {
                      throw new Error("拖拽的 PDF 无法获取本地路径，请使用“本地文件”按钮选择 PDF。");
                    }
                    const text = await apiClient.papers.extractPdfText(droppedPath);
                    setPptDocContent(text);
                    setPptDocError("");
                  } catch (err) {
                    setPptDocContent(null);
                    setPptDocError(formatErrorMessage(err));
                  } finally {
                    setPptDocLoading(false);
                  }
                } else {
                  setPptDocLoading(true);
                  try {
                    const text = await file.text();
                    setPptDocContent(text);
                    setPptDocError("");
                  } catch (err) {
                    setPptDocContent(null);
                    setPptDocError(formatErrorMessage(err));
                  } finally {
                    setPptDocLoading(false);
                  }
                }
              }}
            >
              {pptDocName ? (
                <div className="space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-apple-blue" />
                  <p className="text-sm font-medium text-ink-primary">{pptDocName}</p>
                  <button
                    type="button"
                    onClick={() => { setPptDocName(null); setPptDocContent(null); setPptDocError(""); setPptDocLoading(false); }}
                    className="text-xs text-ink-muted hover:text-apple-red transition-colors"
                  >
                    移除文件
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-8 w-8 mx-auto text-ink-muted" />
                  <div>
                    <p className="text-sm font-medium text-ink-primary">拖拽文件到此处</p>
                    <p className="text-xs text-ink-muted mt-1">支持 PDF、TXT、MD 文档</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const { open } = await import("@tauri-apps/plugin-dialog");
                      const path = await open({
                        filters: [{ name: "文档", extensions: ["pdf", "txt", "md"] }],
                        multiple: false,
                      });
                      if (typeof path === "string") {
                        const name = path.split("/").pop() ?? path;
                        setPptDocName(name);
                        if (name.toLowerCase().endsWith(".pdf")) {
                          setPptDocLoading(true);
                          try {
                            const text = await apiClient.papers.extractPdfText(path);
                            setPptDocContent(text);
                            setPptDocError("");
                          } catch (err) {
                            setPptDocContent(null);
                            setPptDocError(formatErrorMessage(err));
                          } finally {
                            setPptDocLoading(false);
                          }
                        } else {
                          setPptDocLoading(true);
                          try {
                            const { readTextFile } = await import("@tauri-apps/plugin-fs");
                            const text = await readTextFile(path);
                            setPptDocContent(text);
                            setPptDocError("");
                          } catch (err) {
                            setPptDocContent(null);
                            setPptDocError(formatErrorMessage(err));
                          } finally {
                            setPptDocLoading(false);
                          }
                        }
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-secondary transition-all"
                    style={{ background: "var(--rc-elevated)", boxShadow: raisedShadow }}
                  >
                    <FileText className="h-4 w-4" />
                    本地文件
                  </button>
                </div>
              )}
            </div>
            {pptDocLoading && <p className="mt-2 text-xs text-ink-muted">正在读取文档内容…</p>}
            {pptDocError && <p className="mt-2 text-xs text-apple-red">{pptDocError}</p>}
          </div>
        )}

        {pptMode === "outline" && (
          <div className="space-y-2">
            <textarea
              value={pptOutline}
              onChange={(e) => setPptOutline(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void handlePptGenerate(); }}
              rows={8}
              placeholder={"在此处键入或粘贴大纲，内容层级尽量不超过 4 级，例如：\n第一章 章节页标题\n  正文页标题\n    a. 此处为正文小标题\n    此处为正文内容，建议内容尽量精简"}
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none font-mono leading-6"
              style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
            />
            <p className="text-xs text-ink-muted ml-1">小妍会按照大纲层级整理为幻灯片结构</p>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          {/* 风格 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-ink-muted w-6 flex-shrink-0">风格</span>
            {[
              { value: "auto", label: "✦ 小妍推荐" },
              { value: "文献综述", label: "文献综述" },
              { value: "实验汇报", label: "实验汇报" },
              { value: "开题答辩", label: "开题答辩" },
              { value: "技术路线", label: "技术路线" },
              { value: "custom", label: "自定义" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPptStyle(opt.value)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 flex-shrink-0"
                style={
                  pptStyle === opt.value
                    ? { background: "var(--rc-card-inset-bg)", color: "#007AFF", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.12), inset -1px -1px 3px rgba(255,255,255,0.5)", border: "1px solid rgba(0,122,255,0.3)" }
                    : { background: "var(--rc-elevated)", color: "var(--rc-text-muted)", border: "1px solid transparent" }
                }
              >
                {opt.label}
              </button>
            ))}
            {pptStyle === "custom" && (
              <input
                type="text"
                value={pptCustomStyle}
                onChange={(e) => setPptCustomStyle(e.target.value)}
                placeholder="输入科研风格（如：算法推导型）"
                className="rounded-xl px-3 py-1 text-xs outline-none min-w-0 flex-1"
                style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
              />
            )}
          </div>

          {/* 语言 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-ink-muted w-6 flex-shrink-0">语言</span>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: "auto", label: "✦ 小妍推荐" },
                { value: "zh", label: "中文" },
                { value: "en", label: "English" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPptLang(opt.value)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150"
                  style={
                    pptLang === opt.value
                      ? { background: "var(--rc-card-inset-bg)", color: "#007AFF", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.12), inset -1px -1px 3px rgba(255,255,255,0.5)", border: "1px solid rgba(0,122,255,0.3)" }
                      : { background: "var(--rc-elevated)", color: "var(--rc-text-muted)", border: "1px solid transparent" }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 页数 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-ink-muted w-6 flex-shrink-0">页数</span>
            {[
              { value: "auto", label: "✦ 小妍推荐" },
              { value: "8", label: "8 页" },
              { value: "12", label: "12 页" },
              { value: "16", label: "16 页" },
              { value: "20", label: "20 页" },
              { value: "custom", label: "自定义" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPptPages(opt.value)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 flex-shrink-0"
                style={
                  pptPages === opt.value
                    ? { background: "var(--rc-card-inset-bg)", color: "#007AFF", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.12), inset -1px -1px 3px rgba(255,255,255,0.5)", border: "1px solid rgba(0,122,255,0.3)" }
                    : { background: "var(--rc-elevated)", color: "var(--rc-text-muted)", border: "1px solid transparent" }
                }
              >
                {opt.label}
              </button>
            ))}
            {pptPages === "custom" && (
              <input
                type="number"
                min={4}
                max={40}
                value={pptCustomPages}
                onChange={(e) => setPptCustomPages(e.target.value)}
                placeholder="4-40"
                className="w-20 rounded-xl px-3 py-1 text-xs outline-none flex-shrink-0"
                style={{ background: "var(--rc-surface)", boxShadow: insetShadow, color: "var(--rc-text)" }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4">
          {/* Status indicator */}
          <div className="text-xs text-ink-muted min-w-0">
            {pptStatus === "llm" && <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-apple-blue" />小妍正在构思幻灯片结构…</span>}
            {pptStatus === "building" && <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-apple-blue" />正在生成 .pptx 文件…</span>}
            {pptStatus === "ready" && <span className="flex items-center gap-1.5 text-apple-green"><CheckCircle2 className="h-3.5 w-3.5" />已生成 {pptSlideCount} 张幻灯片，可直接在 PowerPoint / WPS 中打开</span>}
            {pptStatus === "idle" && <span>小妍生成可直接打开的 .pptx 文件</span>}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {pptStatus === "ready" && (
              <button
                type="button"
                onClick={() => void handlePptDownload()}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150"
                style={{ background: "linear-gradient(145deg, #38C759, #28A048)", boxShadow: "3px 3px 8px rgba(0,0,0,0.2)" }}
              >
                <Download className="h-4 w-4" />
                下载 .pptx
              </button>
            )}
            <button
              type="button"
              disabled={pptStatus === "llm" || pptStatus === "building" || (pptMode === "topic" && !pptTopic.trim()) || (pptMode === "outline" && !pptOutline.trim()) || (pptMode === "document" && (!pptDocContent || !!pptDocError || pptDocLoading))}
              onClick={() => void handlePptGenerate()}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(145deg, #1A8AFF, #0062CC)", boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)" }}
            >
              {(pptStatus === "llm" || pptStatus === "building") ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {pptStatus === "ready" ? "重新生成" : "立即生成"}
            </button>
          </div>
        </div>

        {pptStatus === "error" && pptError && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{pptError}</span>
          </div>
        )}
      </Card>

      {/* Disabled overlay */}
      {pptFeatureDisabled && (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl z-10">
          <div
            className="flex flex-col items-center gap-3 rounded-3xl px-8 py-6 text-center"
            style={{ background: "var(--rc-elevated)", boxShadow: "var(--rc-raised-shadow)" }}
          >
            <Presentation className="h-8 w-8 text-ink-muted" />
            <p className="text-sm font-semibold text-ink-primary">PPT 生成功能已关闭</p>
            <p className="text-xs text-ink-tertiary">此功能已在技能库中被禁用，请前往设置开启。</p>
            <Link to="/settings" className="text-xs font-medium text-apple-blue hover:underline">
              前往 设置 › 技能库
            </Link>
          </div>
        </div>
      )}
      </div>
      </>}

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
