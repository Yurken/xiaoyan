import { useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Badge, Button, Card, Input, MarkdownRenderer, Select } from "@research-copilot/ui";
import type { Paper, ResearchInterest } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, VenueTypeBadge, WosIndexBadge } from "../components/CcfBadges";
import CollapsibleGroup from "../components/CollapsibleGroup";
import ExternalLink from "../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../lib/client";
import { DEFAULT_PAPER_TAG_VISIBILITY_VALUE, parsePaperTagVisibility } from "../lib/paperTags";

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

type PaperFigure = { id: string; fig_index: number; caption: string | null; data_url: string };

/** Parse figure/table reference numbers from analysis text and match against extracted figures. */
function findReferencedFigures(text: string, figures: PaperFigure[]): PaperFigure[] {
  if (!figures.length || !text) return [];
  const refs = new Set<number>();
  const patterns = [/\bfig(?:ure)?\.?\s*(\d+)/gi, /\b图\s*(\d+)/g, /\btable\s*(\d+)/gi, /\b表\s*(\d+)/g];
  for (const pat of patterns) {
    const re = new RegExp(pat.source, pat.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) refs.add(parseInt(m[1], 10));
  }
  if (!refs.size) return [];
  const result: PaperFigure[] = [];
  const usedIds = new Set<string>();
  for (const n of refs) {
    const byCaption = figures.find(f => {
      if (!f.caption || usedIds.has(f.id)) return false;
      const c = f.caption.toLowerCase();
      return [`figure ${n}`, `fig. ${n}`, `fig ${n}`, `table ${n}`, `图${n}`, `表${n}`].some(p => c.includes(p));
    });
    const match = byCaption ?? figures.find(f => f.fig_index === n && !usedIds.has(f.id));
    if (match) { usedIds.add(match.id); result.push(match); }
  }
  return result;
}

export default function Papers({ hideFolders = false }: { hideFolders?: boolean }) {
  // Tracks papers where BOTH analyze + reproduce are in-flight.
  // Only when both events arrive do we fetch and surface results.
  const pendingPairs = useRef(new Map<string, Set<"analyzed" | "reproduced">>());

  const [papers, setPapers] = useState<Paper[]>([]);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeletePaperId, setConfirmDeletePaperId] = useState<string | null>(null);
  const [confirmReanalyzePaperId, setConfirmReanalyzePaperId] = useState<string | null>(null);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [visiblePaperTags, setVisiblePaperTags] = useState(() => parsePaperTagVisibility(DEFAULT_PAPER_TAG_VISIBILITY_VALUE));
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [recognizeOpen, setRecognizeOpen] = useState(false);
  type RecognizeFlags = { title: boolean; authors: boolean; year: boolean; venue: boolean; keywords: boolean };
  const [recognizeFlags, setRecognizeFlags] = useState<RecognizeFlags>({
    title: true, authors: true, year: true, venue: true, keywords: true,
  });
  const [paperFigures, setPaperFigures] = useState<Record<string, Array<{ id: string; fig_index: number; caption: string | null; data_url: string }>>>({});

  const recognizeRef = useClickOutside(recognizeOpen, () => setRecognizeOpen(false));

  const handleToggleRecognize = async (key: keyof RecognizeFlags) => {
    const next = { ...recognizeFlags, [key]: !recognizeFlags[key] };
    setRecognizeFlags(next);
    try {
      await apiClient.settings.update({ [`paper_import_recognize_${key}`]: next[key] ? "true" : "false" });
    } catch {
      setRecognizeFlags(recognizeFlags);
    }
  };
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  type SortKey = "created_at" | "title" | "importance";
  const [sortKeys, setSortKeys] = useState<Record<string, SortKey>>({});
  const getSortKey = (groupId: string): SortKey => sortKeys[groupId] ?? "created_at";
  const setSortKey = (groupId: string, key: SortKey) =>
    setSortKeys((prev) => ({ ...prev, [groupId]: key }));
  const [keywordFilters, setKeywordFilters] = useState<Record<string, string>>({});
  const setKeywordFilter = (groupId: string, kw: string) =>
    setKeywordFilters((prev) => ({ ...prev, [groupId]: kw }));
  const [titleFilters, setTitleFilters] = useState<Record<string, string>>({});
  const setTitleFilter = (groupId: string, q: string) =>
    setTitleFilters((prev) => ({ ...prev, [groupId]: q }));
  const [editDraft, setEditDraft] = useState({
    title: "",
    authors: "",
    venue: "",
    year: "",
    doi: "",
    research_interest_id: "",
    importance_color: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError("");

    apiClient.papers
      .list()
      .then((data) => {
        if (!cancelled) {
          setPapers(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setPapers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient.knowledge
      .listInterests()
      .then((data) => {
        if (!cancelled) {
          setInterests(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInterests([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient.settings
      .get()
      .then((settings) => {
        if (!cancelled) {
          setVisiblePaperTags(parsePaperTagVisibility(settings.paper_visible_venue_tags));
          setRecognizeFlags({
            title: settings.paper_import_recognize_title !== "false",
            authors: settings.paper_import_recognize_authors !== "false",
            year: settings.paper_import_recognize_year !== "false",
            venue: settings.paper_import_recognize_venue !== "false",
            keywords: settings.paper_import_recognize_keywords !== "false",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVisiblePaperTags(parsePaperTagVisibility(DEFAULT_PAPER_TAG_VISIBILITY_VALUE));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const interestMap = useMemo(
    () => Object.fromEntries(interests.map((item) => [item.id, item])),
    [interests]
  );

  const COLOR_PRIORITY = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE"];

  const sortPapers = (ps: Paper[], key: SortKey): Paper[] => {
    if (key === "title") return [...ps].sort((a, b) => a.title.localeCompare(b.title, "zh"));
    if (key === "importance") return [...ps].sort((a, b) => {
      const ai = a.importance_color ? COLOR_PRIORITY.indexOf(a.importance_color) : COLOR_PRIORITY.length;
      const bi = b.importance_color ? COLOR_PRIORITY.indexOf(b.importance_color) : COLOR_PRIORITY.length;
      return (ai === -1 ? COLOR_PRIORITY.length : ai) - (bi === -1 ? COLOR_PRIORITY.length : bi);
    });
    return [...ps].sort((a, b) => b.created_at.localeCompare(a.created_at));
  };

  const paperGroups = useMemo(() => {
    return interests.map((interest) => {
      const groupPapers = papers.filter((paper) => paper.research_interest_id === interest.id);
      const activeKw = keywordFilters[interest.id]?.toLowerCase();
      const activeTf = titleFilters[interest.id]?.toLowerCase();
      let filtered = activeKw
        ? groupPapers.filter((p) => p.tags?.some((tag) => tag.toLowerCase().includes(activeKw)))
        : groupPapers;
      if (activeTf) filtered = filtered.filter((p) => p.title.toLowerCase().includes(activeTf));
      return {
        key: interest.id,
        title: interestFolderName(interest),
        subtitle: interest.topic,
        papers: sortPapers(filtered, getSortKey(interest.id)),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interests, papers, sortKeys, keywordFilters, titleFilters]);

  const ungroupedBase = useMemo(
    () => papers.filter((paper) => {
      if (!paper.research_interest_id) return true;
      return !(paper.research_interest_id in interestMap);
    }),
    [interestMap, papers],
  );
  const ungroupedPapers = useMemo(() => {
    const activeKw = keywordFilters["ungrouped"]?.toLowerCase();
    const activeTf = titleFilters["ungrouped"]?.toLowerCase();
    let base = activeKw
      ? ungroupedBase.filter((p) => p.tags?.some((tag) => tag.toLowerCase().includes(activeKw)))
      : ungroupedBase;
    if (activeTf) base = base.filter((p) => p.title.toLowerCase().includes(activeTf));
    return sortPapers(base, getSortKey("ungrouped"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ungroupedBase, sortKeys, keywordFilters, titleFilters]);

  // Pre-compute figure-to-section mapping for the expanded paper to avoid
  // re-running regex on every render. Keyed by paper id + figures identity.
  const expandedSectionFigs = useMemo(() => {
    if (!expanded) return null;
    const figs = paperFigures[expanded];
    if (!figs) return null;
    const paper = papers.find((p) => p.id === expanded);
    if (!paper?.analysis) return null;
    type AnalysisKey = "research_question" | "core_method" | "experiment_design" |
      "experiment_results" | "innovations" | "limitations" | "key_conclusions";
    const SECTION_KEYS: AnalysisKey[] = [
      "research_question", "core_method", "experiment_design",
      "experiment_results", "innovations", "limitations", "key_conclusions",
    ];
    const result: Record<string, PaperFigure[]> = {};
    for (const key of SECTION_KEYS) {
      const text = String(paper.analysis[key] ?? "");
      result[key] = findReferencedFigures(text, figs);
    }
    return result;
  }, [expanded, paperFigures, papers]);

  const toFilePath = (item: unknown): string => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "path" in item) return String((item as { path: unknown }).path);
    return "";
  };

  const handleUpload = async () => {
    try {
      setLoadError("");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;

      const paths = (Array.isArray(selected) ? selected : [selected])
        .map(toFilePath)
        .filter(Boolean);

      if (paths.length === 0) return;

      setUploading(true);
      setBatchProgress({ done: 0, total: paths.length });

      const failures: string[] = [];
      const succeededPaths: string[] = [];
      for (let i = 0; i < paths.length; i++) {
        try {
          await apiClient.papers.upload(paths[i], selectedInterestId || undefined);
          succeededPaths.push(paths[i]);
        } catch (err) {
          const name = paths[i].split("/").pop() ?? paths[i];
          failures.push(`${name}：${formatErrorMessage(err)}`);
        }
        setBatchProgress({ done: i + 1, total: paths.length });
      }

      const updated = await apiClient.papers.list();
      setPapers(updated);

      if (succeededPaths.length > 0) {
        void apiClient.memory.add({
          type: "auto",
          action: "paper.upload",
          summary: succeededPaths.length === 1
            ? `上传了论文：${succeededPaths[0].split("/").pop() ?? succeededPaths[0]}`
            : `批量上传了 ${succeededPaths.length} 篇论文`,
        });
      }
      if (failures.length > 0) {
        setLoadError(failures.join("\n"));
      }
    } catch (error) {
      console.error(error);
      setLoadError(formatErrorMessage(error));
    } finally {
      setUploading(false);
      setBatchProgress(null);
    }
  };

  useEffect(() => {
    const doFetch = (paper_id: string, finalStatus: string) => {
      void apiClient.papers
        .get(paper_id)
        .then((latest) => {
          setPapers((prev) => prev.map((p) => (p.id === paper_id ? latest : p)));
        })
        .catch((fetchError) => {
          setLoadError(formatErrorMessage(fetchError));
        });
      // Update status locally immediately so the badge reflects completion
      setPapers((prev) => prev.map((p) => (p.id === paper_id ? { ...p, status: finalStatus } : p)));
    };

    const unlisten = listen<{ paper_id: string; status: string; error?: string }>("paper:status", (event) => {
      const { paper_id, status, error } = event.payload;

      if (status === "analyzed" || status === "reproduced") {
        const pending = pendingPairs.current.get(paper_id);
        if (pending) {
          // We initiated this pair — wait until both arrive before surfacing results
          pending.delete(status as "analyzed" | "reproduced");
          if (pending.size === 0) {
            pendingPairs.current.delete(paper_id);
            doFetch(paper_id, status);
          }
          // While still waiting for the partner event, keep status as "analyzing" (no state update)
          return;
        }
        // Single-task completion (e.g. loaded from a previous session's background task)
        doFetch(paper_id, status);
        return;
      }

      if (status === "metadata") {
        // 元数据识别完成：刷新论文字段，但保留当前处理状态（parsing）
        void apiClient.papers.get(paper_id).then((latest) => {
          setPapers((prev) => prev.map((p) => (p.id === paper_id ? { ...latest, status: p.status } : p)));
        }).catch(() => {});
        return;
      }

      if (status === "parsed") {
        doFetch(paper_id, status);
        return;
      }

      if (status === "error" || status === "failed") {
        pendingPairs.current.delete(paper_id);
        setPapers((prev) => prev.map((p) => (p.id === paper_id ? { ...p, status } : p)));
        if (error) setLoadError(error);
        return;
      }

      // Any other status update (e.g. "analyzing" from backend)
      setPapers((prev) => prev.map((p) => (p.id === paper_id ? { ...p, status } : p)));
    });

    return () => {
      void unlisten.then((cleanup) => cleanup());
    };
  }, []);

  // Fetch figures when a paper is expanded for the first time
  useEffect(() => {
    if (!expanded || paperFigures[expanded] !== undefined) return;
    void apiClient.papers.listFigures(expanded).then((figs) => {
      setPaperFigures((prev) => ({ ...prev, [expanded]: figs }));
    }).catch(() => {
      setPaperFigures((prev) => ({ ...prev, [expanded]: [] }));
    });
  }, [expanded]);

  const handleAnalyze = async (id: string) => {
    try {
      setConfirmReanalyzePaperId(null);
      setLoadError("");
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, status: "analyzing" } : paper)));
      // Register both expected completion events before firing requests
      pendingPairs.current.set(id, new Set(["analyzed", "reproduced"]));
      const paper = papers.find((p) => p.id === id);
      if (paper) {
        void apiClient.memory.add({
          type: "auto",
          action: "paper.analyze",
          summary: `触发小妍解读论文：《${paper.title}》`,
          detail: JSON.stringify({ paper_id: id }),
        });
      }
      await Promise.all([
        apiClient.papers.analyze(id),
        apiClient.papers.reproduce(id),
      ]);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      pendingPairs.current.delete(id);
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, status: "failed" } : paper)));
    }
  };

  const requiresReanalyzeConfirm = (paper: Paper) => paper.status === "analyzed" || paper.status === "reproduced";

  const openEditor = (paper: Paper) => {
    setEditingId(paper.id);
    setEditDraft({
      title: paper.title || "",
      authors: paper.authors || "",
      venue: paper.venue || "",
      year: paper.year ? String(paper.year) : "",
      doi: paper.doi || "",
      research_interest_id: paper.research_interest_id || "",
      importance_color: paper.importance_color || "",
      notes: paper.notes || "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const nextTitle = editDraft.title.trim();
      if (!nextTitle) {
        throw new Error("论文标题不能为空");
      }

      const yearText = editDraft.year.trim();
      const nextYear = yearText ? Number.parseInt(yearText, 10) : 0;
      if (yearText && Number.isNaN(nextYear)) {
        throw new Error("年份必须是合法数字");
      }

      setSavingEdit(true);
      setLoadError("");
      const updated = await apiClient.papers.update(id, {
        title: nextTitle,
        authors: editDraft.authors.trim(),
        venue: editDraft.venue.trim(),
        year: nextYear,
        doi: editDraft.doi.trim(),
        research_interest_id: editDraft.research_interest_id,
        importance_color: editDraft.importance_color,
        notes: editDraft.notes,
      });
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, ...updated } : paper)));
      setEditingId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePaper = async (id: string) => {
    try {
      setDeletingPaperId(id);
      setLoadError("");
      await apiClient.papers.delete(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
      setConfirmDeletePaperId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setDeletingPaperId(null);
    }
  };

  const handleDeleteInterestGroup = async (interestId: string, deleteAll: boolean) => {
    try {
      setDeletingGroupId(interestId);
      setLoadError("");
      if (deleteAll) {
        await apiClient.knowledge.deleteInterestBundle(interestId);
        setPapers((prev) => prev.filter((p) => p.research_interest_id !== interestId));
      } else {
        await apiClient.knowledge.deleteInterestOnly(interestId);
      }
      setInterests((prev) => prev.filter((item) => item.id !== interestId));
      setConfirmDeleteGroupId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setDeletingGroupId(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "analyzed" || status === "reproduced") return <Badge variant="success">已解读</Badge>;
    if (status === "failed" || status === "error") return <Badge variant="danger">失败</Badge>;
    if (status === "analyzing") return <Badge variant="info">分析中</Badge>;
    if (status === "parsing") return <Badge variant="info">解析中</Badge>;
    if (status === "parsed") return <Badge variant="info">已解析</Badge>;
    if (status === "uploaded") return <Badge variant="default">已上传</Badge>;
    return <Badge variant="default">待分析</Badge>;
  };

  const statusIcon = (status: string) => {
    if (status === "analyzed" || status === "reproduced") {
      return <CheckCircle className="w-5 h-5 text-apple-green" />;
    }
    if (status === "failed" || status === "error") {
      return <AlertCircle className="w-5 h-5 text-apple-red" />;
    }
    if (status === "analyzing") {
      return (
        <div className="flex items-center gap-[3px]">
          {([0, 0.18, 0.36] as number[]).map((delay, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-apple-blue"
              style={{ animation: "thinking-dot 1.1s ease-in-out infinite", animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      );
    }
    if (status === "parsing" || status === "uploaded") {
      return <Loader2 className="w-4 h-4 text-apple-blue animate-spin" />;
    }
    return <FileText className="w-5 h-5 text-ink-tertiary" />;
  };

  const canStartAnalyze = (status: string) => !["analyzing", "parsing", "uploaded"].includes(status);

  const analyzeButtonLabel = (status: string) => {
    if (status === "analyzing") return "分析中…";
    if (status === "parsing") return "解析中…";
    if (status === "uploaded") return "排队解析…";
    return "小妍解读";
  };

  const hasLoadedContent = papers.length > 0 || interests.length > 0;

  const SORT_LABELS: Record<SortKey, string> = { created_at: "导入时间", title: "名称", importance: "重要性" };

  const renderSortControl = (groupId: string) => (
    <div className="flex items-center gap-1">
      {(["created_at", "title", "importance"] as SortKey[]).map((key) => {
        const active = getSortKey(groupId) === key;
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => { e.stopPropagation(); setSortKey(groupId, key); }}
            className="rounded-lg px-2 py-0.5 text-[10px] transition-all"
            style={{
              background: active ? "#007AFF" : "var(--rc-surface)",
              color: active ? "#fff" : "#999",
              boxShadow: active ? "inset 1px 1px 2px rgba(0,0,0,0.2)" : "var(--rc-chip-shadow)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {SORT_LABELS[key]}
          </button>
        );
      })}
    </div>
  );

  const inputStyle = (active: boolean) => ({
    background: active ? "rgba(0,122,255,0.1)" : "var(--rc-surface)",
    color: active ? "#007AFF" : "#8E8E93",
    fontWeight: active ? 600 : 400,
    boxShadow: active
      ? "inset 1px 1px 2px rgba(0,122,255,0.15)"
      : "var(--rc-chip-shadow)",
  });

  const renderGroupControls = (groupId: string) => {
    const activeKw = keywordFilters[groupId] ?? "";
    const activeTf = titleFilters[groupId] ?? "";
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={activeTf}
          placeholder="搜索标题"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); setTitleFilter(groupId, e.target.value); }}
          className="rounded-lg px-2 py-0.5 text-[10px] outline-none border-none w-20"
          style={inputStyle(!!activeTf)}
        />
        <input
          type="text"
          value={activeKw}
          placeholder="关键词筛选"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); setKeywordFilter(groupId, e.target.value); }}
          className="rounded-lg px-2 py-0.5 text-[10px] outline-none border-none w-20"
          style={inputStyle(!!activeKw)}
        />
        {renderSortControl(groupId)}
      </div>
    );
  };

  const renderPaperCard = (paper: Paper, groupId = "ungrouped") => (
    <Card key={paper.id} padding="sm" className="space-y-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.82)", borderTop: paper.importance_color ? `3px solid ${paper.importance_color}` : undefined }}>
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl mt-0.5"
          style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
        >
          {statusIcon(paper.status)}
        </div>

        {/* 主信息 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {paper.file_path ? (
              <button
                type="button"
                className="text-left text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
                title="使用默认应用打开 PDF"
                onClick={() => void apiClient.papers.openFile(paper.id)}
              >
                {paper.title}
              </button>
            ) : (
              <ExternalLink
                href={paper.paper_url}
                className="text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
              >
                {paper.title}
              </ExternalLink>
            )}
            {statusBadge(paper.status)}
          </div>
          {/* 来源行 */}
          {(paper.venue || paper.ccf_area || paper.ccf_publisher || paper.journal_publisher) && (
            <p className="mt-0.5 text-xs leading-5 text-ink-secondary">
              {paper.venue ? (
                <ExternalLink
                  href={paper.venue_url}
                  className="text-xs text-ink-secondary hover:text-apple-blue hover:underline"
                >
                  {paper.venue}
                </ExternalLink>
              ) : "来源未知"}
              {paper.ccf_area ? ` · ${paper.ccf_area}` : ""}
              {paper.ccf_publisher ? ` · ${paper.ccf_publisher}` : ""}
              {!paper.ccf_publisher && paper.journal_publisher ? ` · ${paper.journal_publisher}` : ""}
            </p>
          )}
          {/* 评级标签行 */}
          {(paper.year || visiblePaperTags.has("ccf_rating") || visiblePaperTags.has("ccf_type") || visiblePaperTags.has("wos_indexes") || visiblePaperTags.has("jcr_quartile") || visiblePaperTags.has("cas_quartile") || visiblePaperTags.has("cas_top")) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {paper.year && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "rgba(0,0,0,0.06)", color: "#888" }}>
                  {paper.year}
                </span>
              )}
              {visiblePaperTags.has("ccf_rating") ? <CcfRatingBadge rating={paper.ccf_rating} /> : null}
              {visiblePaperTags.has("ccf_type") ? <VenueTypeBadge type={paper.ccf_type} /> : null}
              {visiblePaperTags.has("wos_indexes")
                ? paper.wos_indexes?.map((index) => (
                    <WosIndexBadge key={`${paper.id}-${index}`} index={index} />
                  ))
                : null}
              {visiblePaperTags.has("jcr_quartile") ? <JcrQuartileBadge quartile={paper.jcr_quartile} /> : null}
              {visiblePaperTags.has("cas_quartile") ? <CasQuartileBadge quartile={paper.cas_quartile} /> : null}
              {visiblePaperTags.has("cas_top") ? <CasTopBadge top={paper.cas_top} /> : null}
            </div>
          )}
          {(paper.tags?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {paper.tags!.map((tag) => {
                const kf = keywordFilters[groupId];
                const active = !!kf && tag.toLowerCase().includes(kf.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setKeywordFilter(groupId, active ? "" : tag); }}
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-all"
                    style={{
                      background: active ? "rgba(0,122,255,0.15)" : "rgba(0,122,255,0.07)",
                      color: active ? "#005EC8" : "#007AFF",
                      boxShadow: active ? "inset 1px 1px 2px rgba(0,122,255,0.15)" : "none",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 操作区：图标工具 + 主要 CTA */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
          {/* 次要操作：图标按钮 */}
          <button
            type="button"
            onClick={() => {
              if (editingId === paper.id) {
                setEditingId(null);
              } else {
                openEditor(paper);
              }
            }}
            className={[
              "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
              editingId === paper.id ? "text-apple-blue" : "text-ink-tertiary hover:text-ink-primary",
            ].join(" ")}
            style={{
              background: "var(--rc-surface)",
              boxShadow: editingId === paper.id
                ? "var(--rc-inset-shadow)"
                : "var(--rc-chip-shadow)",
            }}
            title={editingId === paper.id ? "收起编辑" : "编辑信息"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setConfirmDeletePaperId(confirmDeletePaperId === paper.id ? null : paper.id)}
            className={[
              "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
              confirmDeletePaperId === paper.id ? "text-apple-red" : "text-ink-tertiary/50 hover:text-apple-red",
            ].join(" ")}
            style={{
              background: "var(--rc-surface)",
              boxShadow: confirmDeletePaperId === paper.id
                ? "var(--rc-inset-shadow)"
                : "var(--rc-chip-shadow)",
            }}
            title="删除论文"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* 主要 CTA */}
          <Button
            size="sm"
            onClick={() => {
              if (requiresReanalyzeConfirm(paper)) {
                setConfirmReanalyzePaperId((prev) => (prev === paper.id ? null : paper.id));
                return;
              }
              void handleAnalyze(paper.id);
            }}
            disabled={!canStartAnalyze(paper.status)}
          >
            {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {analyzeButtonLabel(paper.status)}
          </Button>

          {/* 展开按钮 */}
          {(paper.analysis || paper.reproduction_guide) && (
            <button
              type="button"
              onClick={() => {
                const isOpening = expanded !== paper.id;
                setExpanded(expanded === paper.id ? null : paper.id);
                if (isOpening) {
                  void apiClient.memory.add({
                    type: "auto",
                    action: "paper.view",
                    summary: `查看了论文解读：《${paper.title}》`,
                    detail: JSON.stringify({ paper_id: paper.id }),
                  });
                }
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-tertiary hover:text-ink-primary transition-colors"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              {expanded === paper.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          </div>
          <p className="text-[11px] text-ink-tertiary">
            {new Date(paper.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </p>
        </div>
      </div>

      {confirmDeletePaperId === paper.id && (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(255,59,48,0.06)" }}
        >
          <span className="text-xs text-apple-red">确认删除这篇论文？此操作无法撤销。</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirmDeletePaperId(null)}>
              取消
            </Button>
            <button
              type="button"
              onClick={() => void handleDeletePaper(paper.id)}
              disabled={deletingPaperId === paper.id}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: "#FF3B30" }}
            >
              {deletingPaperId === paper.id && <Loader2 className="h-3 w-3 animate-spin" />}
              删除
            </button>
          </div>
        </div>
      )}

      {confirmReanalyzePaperId === paper.id && (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(0,122,255,0.08)" }}
        >
          <span className="text-xs text-[#0A62D0]">该论文已有解读结果，确认要重新解读并覆盖最新结果吗？</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirmReanalyzePaperId(null)}>
              取消
            </Button>
            <button
              type="button"
              onClick={() => void handleAnalyze(paper.id)}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors"
              style={{ background: "#007AFF" }}
            >
              确认重新解读
            </button>
          </div>
        </div>
      )}

      {editingId === paper.id && (
        <div className="mt-3 grid gap-3 border-t border-nm-dark/10 pt-3 md:grid-cols-2">
          <Input
            label="标题"
            value={editDraft.title}
            onChange={(event) => setEditDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="论文标题"
          />
          <Input
            label="作者"
            value={editDraft.authors}
            onChange={(event) => setEditDraft((prev) => ({ ...prev, authors: event.target.value }))}
            placeholder="作者列表"
          />
          <Input
            label="来源/会议/期刊"
            value={editDraft.venue}
            onChange={(event) => setEditDraft((prev) => ({ ...prev, venue: event.target.value }))}
            placeholder="例如：CVPR / IEEE Transactions on Knowledge and Data Engineering"
          />
          <Input
            label="年份"
            value={editDraft.year}
            onChange={(event) => setEditDraft((prev) => ({ ...prev, year: event.target.value }))}
            placeholder="例如：2024"
          />
          <Select
            label="主题文件夹"
            value={editDraft.research_interest_id}
            onChange={(value) => setEditDraft((prev) => ({ ...prev, research_interest_id: value }))}
            options={[
              { value: "", label: "未归档" },
              ...interests.map((interest) => ({
                value: interest.id,
                label: interestFolderName(interest),
              })),
            ]}
          />
          <div className="md:col-span-2">
            <Input
              label="DOI"
              value={editDraft.doi}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, doi: event.target.value }))}
              placeholder="例如：10.1145/xxxx"
            />
          </div>
          {/* 重要性颜色 */}
          <div className="md:col-span-2 space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">重要性标记</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { color: "", label: "无" },
                { color: "#FF3B30", label: "极其重要" },
                { color: "#FF9500", label: "非常重要" },
                { color: "#FFCC00", label: "重要" },
                { color: "#34C759", label: "较重要" },
                { color: "#007AFF", label: "一般" },
                { color: "#AF52DE", label: "不重要" },
              ].map(({ color, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setEditDraft((prev) => ({ ...prev, importance_color: color }))}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs transition-all"
                  style={{
                    background: editDraft.importance_color === color ? (color || "rgba(0,0,0,0.08)") : "var(--rc-surface)",
                    color: editDraft.importance_color === color && color ? "#fff" : "#666",
                    boxShadow: editDraft.importance_color === color
                      ? "inset 1px 1px 3px rgba(0,0,0,0.2)"
                      : "var(--rc-chip-shadow)",
                    fontWeight: editDraft.importance_color === color ? 600 : 400,
                  }}
                >
                  {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* 备注 */}
          <div className="md:col-span-2 space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">备注</label>
            <textarea
              value={editDraft.notes}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="添加备注，将显示在论文卡片底部"
              rows={2}
              className="w-full resize-none rounded-2xl px-4 py-2.5 text-sm text-ink-primary outline-none transition-all duration-150"
              style={{
                background: "var(--rc-surface)",
                boxShadow: "var(--rc-inset-shadow)",
              }}
            />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
              取消
            </Button>
            <Button size="sm" onClick={() => void handleSaveEdit(paper.id)} loading={savingEdit}>
              保存
            </Button>
          </div>
        </div>
      )}

      {paper.notes && editingId !== paper.id && (
        <p className="mt-2 border-t border-black/5 pt-2 text-[11px] leading-relaxed text-ink-tertiary/80">{paper.notes}</p>
      )}

      {expanded === paper.id && (paper.analysis || paper.reproduction_guide) && (
        <div className="mt-3 border-t border-nm-dark/10 pt-3 space-y-5">
          {paper.analysis && (() => {
            const SECTIONS: Array<{ key: keyof typeof paper.analysis; label: string; color: string; bg: string }> = [
              { key: "research_question", label: "研究问题", color: "#007AFF", bg: "rgba(0,122,255,0.05)" },
              { key: "core_method",       label: "核心方法", color: "#AF52DE", bg: "rgba(175,82,222,0.05)" },
              { key: "experiment_design", label: "实验设计", color: "#5856D6", bg: "rgba(88,86,214,0.05)" },
              { key: "experiment_results",label: "实验结果", color: "#34C759", bg: "rgba(52,199,89,0.05)" },
              { key: "innovations",       label: "创新点",   color: "#FF9500", bg: "rgba(255,149,0,0.05)" },
              { key: "limitations",       label: "局限性",   color: "#FF3B30", bg: "rgba(255,59,48,0.05)" },
              { key: "key_conclusions",   label: "关键结论", color: "#00C7BE", bg: "rgba(0,199,190,0.05)" },
            ];
            const filled = SECTIONS.filter(({ key }) => paper.analysis![key]);
            if (filled.length === 0) return null;
            const figs = paperFigures[paper.id] ?? [];
            const sectionFigs = filled.map(({ key }) =>
              (paper.id === expanded && expandedSectionFigs)
                ? (expandedSectionFigs[key] ?? [])
                : findReferencedFigures(String(paper.analysis![key] ?? ""), figs)
            );
            return (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold text-ink-tertiary tracking-widest uppercase pl-0.5">小妍解读</p>
                {filled.map(({ key, label, color, bg }, i) => (
                  <div
                    key={key}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: bg, borderLeft: `3px solid ${color}` }}
                  >
                    <div className="px-3 pt-2.5 pb-0.5">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: `${color}18`, color }}
                      >
                        {label}
                      </span>
                    </div>
                    <div className="px-3 pt-1 pb-3">
                      <MarkdownRenderer content={String(paper.analysis![key] ?? "")} />
                      {sectionFigs[i].length > 0 && (
                        <div
                          className="mt-2.5 pt-2.5 space-y-3"
                          style={{ borderTop: `1px solid ${color}20` }}
                        >
                          {sectionFigs[i].map(fig => (
                            <div key={fig.id} className="flex flex-col items-center gap-1.5">
                              <img
                                src={fig.data_url}
                                alt={fig.caption ?? `图 ${fig.fig_index}`}
                                title={fig.caption ?? undefined}
                                loading="lazy"
                                className="rounded-xl object-contain mx-auto"
                                style={{ maxWidth: "100%", maxHeight: 400, background: "rgba(0,0,0,0.03)", border: `1px solid ${color}30` }}
                              />
                              {fig.caption && (
                                <span className="text-[10px] text-ink-tertiary text-center leading-snug px-2">{fig.caption}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {paper.reproduction_guide && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-ink-tertiary tracking-widest uppercase pl-0.5">复现指南</p>
              {(
                [
                  ["代码仓库", paper.reproduction_guide.code_repository],
                  ["环境配置", paper.reproduction_guide.environment_setup],
                  ["依赖安装", paper.reproduction_guide.dependencies],
                  ["数据准备", paper.reproduction_guide.dataset_preparation],
                  ["训练流程", paper.reproduction_guide.training_process],
                  ["推理流程", paper.reproduction_guide.inference_process],
                  ["评估指标", paper.reproduction_guide.evaluation_metrics],
                  ["风险与注意事项", paper.reproduction_guide.risks_and_notes],
                ] as [string, string | undefined][]
              )
                .filter(([, value]) => value && value !== "暂无")
                .map(([label, value]) => (
                  <div key={label} className="rounded-2xl overflow-hidden" style={{ background: "rgba(0,122,255,0.04)", borderLeft: "3px solid rgba(0,122,255,0.4)" }}>
                    <div className="px-3 pt-2.5 pb-0.5">
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}>{label}</span>
                    </div>
                    <div className="px-3 pt-1 pb-3">
                      <MarkdownRenderer content={value ?? ""} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <>
      <style>{`
        @keyframes thinking-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      <div className="rc-app-page space-y-5" style={{ background: "var(--rc-surface)" }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">论文库</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            {`共 ${papers.length} 篇论文 · ${interests.length} 个主题分组`}
          </p>
          <p className="mt-1 text-sm text-ink-tertiary">
            上传 PDF，小妍帮你精读、提取图表、生成复现指南。
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
          {/* 自动识别下拉 */}
          <div
            ref={recognizeRef}
            className="relative flex-shrink-0"
          >
            <button
              type="button"
              onClick={() => setRecognizeOpen((v) => !v)}
              data-open={recognizeOpen}
              className="rc-dropdown-trigger flex items-center gap-1.5 rounded-2xl px-3 py-2 transition-all duration-150"
              title="导入时自动识别论文内容"
            >
              <span className="text-xs font-medium text-ink-secondary">自动识别</span>
              <ChevronDown className={`w-3.5 h-3.5 text-ink-tertiary transition-transform ${recognizeOpen ? "rotate-180" : ""}`} />
            </button>

            {recognizeOpen && (
              <div
                className="rc-dropdown-menu absolute left-0 top-full mt-1.5 z-30 min-w-[160px] rounded-2xl py-2"
              >
                {(
                  [
                    { key: "title", label: "名称" },
                    { key: "authors", label: "作者" },
                    { key: "year", label: "年份" },
                    { key: "venue", label: "期刊 / 会议" },
                    { key: "keywords", label: "关键词" },
                  ] as { key: keyof RecognizeFlags; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void handleToggleRecognize(key)}
                    className="w-full flex items-center gap-2.5 px-4 py-1.5 text-xs text-ink-primary hover:bg-white/40 transition-colors"
                  >
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        background: recognizeFlags[key] ? "#007AFF" : "transparent",
                        border: recognizeFlags[key] ? "none" : "1.5px solid #B0B5BB",
                      }}
                    >
                      {recognizeFlags[key] && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!hideFolders && (
            <Select
              className="min-w-[200px]"
              prefix="文件夹："
              value={selectedInterestId}
              onChange={setSelectedInterestId}
              options={[
                { value: "", label: "未归档" },
                ...interests.map((interest) => ({
                  value: interest.id,
                  label: interestFolderName(interest),
                })),
              ]}
            />
          )}
          <Button onClick={handleUpload} loading={uploading} size="md">
            <Upload className="w-4 h-4" />
            {batchProgress ? `导入中 (${batchProgress.done}/${batchProgress.total})` : "导入 PDF"}
          </Button>
        </div>
      </div>

      {loadError && hasLoadedContent && (
        <Card className="flex items-start gap-3 border border-apple-red/10 bg-[#F7ECEA] px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-apple-red" />
          <div>
            <p className="text-sm font-medium text-ink-secondary">操作未完成</p>
            <p className="mt-1 break-all text-sm text-apple-red">{loadError}</p>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          >
            <Loader2 className="h-7 w-7 animate-spin text-apple-blue" />
          </div>
          <p className="text-sm text-ink-tertiary">加载中…</p>
        </div>
      ) : loadError && !hasLoadedContent ? (
        <Card className="flex flex-col items-center gap-4 py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          >
            <AlertCircle className="h-8 w-8 text-apple-red" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">加载失败</p>
            <p className="mt-1 break-all text-sm text-apple-red">{loadError}</p>
          </div>
        </Card>
      ) : papers.length === 0 && interests.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          >
            <FileText className="h-8 w-8 text-ink-tertiary" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">还没有论文</p>
            <p className="mt-1 text-sm text-ink-tertiary">上传第一篇 PDF，小妍帮你精读和分析。</p>
          </div>
        </Card>
      ) : hideFolders ? (
        <div className="space-y-3">
          {sortPapers(papers, getSortKey("all")).map((p) => renderPaperCard(p, "all"))}
        </div>
      ) : (
        <div className="space-y-3">
          {paperGroups.map((group) => (
            <CollapsibleGroup
              key={group.key}
              title={group.title}
              subtitle={group.subtitle !== group.title ? `研究主题：${group.subtitle}` : undefined}
              countLabel={`${group.papers.length} 篇`}
              defaultOpen={group.papers.length > 0}
              bodyClassName="space-y-3"
              actions={
                confirmDeleteGroupId === group.key ? (
                  <>
                    <span className="text-xs text-ink-tertiary">删除文件夹：</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={deletingGroupId === group.key}
                      onClick={() => void handleDeleteInterestGroup(group.key, false)}
                    >
                      置为未归档
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={deletingGroupId === group.key}
                      onClick={() => void handleDeleteInterestGroup(group.key, true)}
                    >
                      删除全部
                    </Button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteGroupId(null)}
                      className="text-ink-tertiary hover:text-ink-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    {renderGroupControls(group.key)}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteGroupId(group.key)}
                      className="text-ink-tertiary/40 transition-colors hover:text-apple-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )
              }
            >
              {group.papers.length === 0 ? (
                <Card padding="sm" className="border border-dashed border-nm-dark/10 bg-white/25 py-8 text-center text-sm text-ink-tertiary">
                  这个方向下还没有论文，上传 PDF 后会显示在这里。
                </Card>
              ) : (
                group.papers.map((p) => renderPaperCard(p, group.key))
              )}
            </CollapsibleGroup>
          ))}

          {ungroupedPapers.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-sm font-semibold text-ink-primary">未归档论文</p>
                  <p className="mt-0.5 text-xs text-ink-tertiary">这些论文暂未绑定主题，编辑后可移动到主题文件夹。</p>
                </div>
                {renderGroupControls("ungrouped")}
              </div>
              {ungroupedPapers.map((p) => renderPaperCard(p, "ungrouped"))}
            </section>
          )}
        </div>
      )}
    </div>
    </>
  );
}
