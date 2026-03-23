import { useEffect, useMemo, useRef, useState } from "react";
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
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import type { Paper, ResearchInterest } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, VenueTypeBadge, WosIndexBadge } from "../components/CcfBadges";
import CollapsibleGroup from "../components/CollapsibleGroup";
import ExternalLink from "../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../lib/client";
import { DEFAULT_PAPER_TAG_VISIBILITY_VALUE, parsePaperTagVisibility } from "../lib/paperTags";

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

export default function Papers() {
  // Tracks papers where BOTH analyze + reproduce are in-flight.
  // Only when both events arrive do we fetch and surface results.
  const pendingPairs = useRef(new Map<string, Set<"analyzed" | "reproduced">>());

  const [papers, setPapers] = useState<Paper[]>([]);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeletePaperId, setConfirmDeletePaperId] = useState<string | null>(null);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [visiblePaperTags, setVisiblePaperTags] = useState(() => parsePaperTagVisibility(DEFAULT_PAPER_TAG_VISIBILITY_VALUE));
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [editFolderPickerOpen, setEditFolderPickerOpen] = useState(false);
  const [autoRename, setAutoRename] = useState(true);

  const handleToggleAutoRename = async () => {
    const next = !autoRename;
    setAutoRename(next);
    try {
      await apiClient.settings.update({ paper_auto_rename_on_import: next ? "true" : "false" });
    } catch {
      setAutoRename(!next); // rollback on error
    }
  };
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  type SortKey = "created_at" | "title" | "importance";
  const [sortKeys, setSortKeys] = useState<Record<string, SortKey>>({});
  const getSortKey = (groupId: string): SortKey => sortKeys[groupId] ?? "created_at";
  const setSortKey = (groupId: string, key: SortKey) =>
    setSortKeys((prev) => ({ ...prev, [groupId]: key }));
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
          setAutoRename(settings.paper_auto_rename_on_import !== "false");
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
    return interests.map((interest) => ({
      key: interest.id,
      title: interestFolderName(interest),
      subtitle: interest.topic,
      papers: sortPapers(
        papers.filter((paper) => paper.research_interest_id === interest.id),
        getSortKey(interest.id),
      ),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interests, papers, sortKeys]);

  const ungroupedPapers = useMemo(() => (
    sortPapers(
      papers.filter((paper) => {
        if (!paper.research_interest_id) return true;
        return !(paper.research_interest_id in interestMap);
      }),
      getSortKey("ungrouped"),
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [interestMap, papers, sortKeys]);

  const handleUpload = async () => {
    try {
      setLoadError("");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;

      const selectedPath =
        typeof selected === "string"
          ? selected
          : typeof selected === "object" && selected !== null && "path" in selected
            ? String((selected as { path: unknown }).path)
            : "";

      if (!selectedPath) {
        throw new Error("未识别的文件路径，请重新选择 PDF 文件");
      }

      setUploading(true);
      await apiClient.papers.upload(selectedPath, selectedInterestId || undefined);
      const updated = await apiClient.papers.list();
      setPapers(updated);
    } catch (error) {
      console.error(error);
      setLoadError(formatErrorMessage(error));
    } finally {
      setUploading(false);
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

  const handleAnalyze = async (id: string) => {
    try {
      setLoadError("");
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, status: "analyzing" } : paper)));
      // Register both expected completion events before firing requests
      pendingPairs.current.set(id, new Set(["analyzed", "reproduced"]));
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
    if (status === "parsed") return <Badge variant="info">已解析</Badge>;
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
    return <FileText className="w-5 h-5 text-ink-tertiary" />;
  };

  const SORT_LABELS: Record<SortKey, string> = { created_at: "时间", title: "名称", importance: "重要性" };

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
              background: active ? "#007AFF" : "#E8ECF0",
              color: active ? "#fff" : "#999",
              boxShadow: active ? "inset 1px 1px 2px rgba(0,0,0,0.2)" : "1px 1px 3px #C8CDD3, -1px -1px 3px #FFFFFF",
              fontWeight: active ? 600 : 400,
            }}
          >
            {SORT_LABELS[key]}
          </button>
        );
      })}
    </div>
  );

  const renderPaperCard = (paper: Paper) => (
    <Card key={paper.id} padding="sm" className="space-y-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.82)", borderTop: paper.importance_color ? `3px solid ${paper.importance_color}` : undefined }}>
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl mt-0.5"
          style={{ background: "#F0F4F8", boxShadow: "inset 2px 2px 4px #C8CDD3, inset -2px -2px 4px #FFFFFF" }}
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
              background: "#EEF1F5",
              boxShadow: editingId === paper.id
                ? "inset 2px 2px 4px #C8CDD3, inset -2px -2px 4px #FFFFFF"
                : "2px 2px 4px #C8CDD3, -2px -2px 4px #FFFFFF",
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
              background: "#EEF1F5",
              boxShadow: confirmDeletePaperId === paper.id
                ? "inset 2px 2px 4px #C8CDD3, inset -2px -2px 4px #FFFFFF"
                : "2px 2px 4px #C8CDD3, -2px -2px 4px #FFFFFF",
            }}
            title="删除论文"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* 主要 CTA */}
          <Button
            size="sm"
            onClick={() => void handleAnalyze(paper.id)}
            disabled={paper.status === "analyzing"}
          >
            {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {paper.status === "analyzing" ? "分析中…" : "小妍解读"}
          </Button>

          {/* 展开按钮 */}
          {(paper.analysis || paper.reproduction_guide) && (
            <button
              type="button"
              onClick={() => setExpanded(expanded === paper.id ? null : paper.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-tertiary hover:text-ink-primary transition-colors"
              style={{ background: "#EEF1F5", boxShadow: "2px 2px 4px #C8CDD3, -2px -2px 4px #FFFFFF" }}
            >
              {expanded === paper.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          </div>
          <p className="text-[11px] text-ink-tertiary">
            {new Date(paper.created_at).toLocaleDateString("zh-CN")}
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
          <div
            className="relative space-y-1"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setEditFolderPickerOpen(false);
              }
            }}
          >
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">主题文件夹</label>
            <button
              type="button"
              onClick={() => setEditFolderPickerOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-sm text-ink-primary transition-all duration-150"
              style={{
                background: "#E8ECF0",
                boxShadow: editFolderPickerOpen
                  ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
                  : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
              }}
            >
              <span className="truncate">
                {editDraft.research_interest_id
                  ? interestFolderName(interests.find((i) => i.id === editDraft.research_interest_id)!)
                  : "未归档"}
              </span>
              <ChevronDown
                className="h-4 w-4 flex-shrink-0 text-ink-tertiary transition-transform duration-150"
                style={{ transform: editFolderPickerOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {editFolderPickerOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl py-1 overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #F2F6FA, #E8ECF0)",
                  boxShadow: "6px 6px 14px #C0C6CC, -4px -4px 10px #FFFFFF",
                }}
              >
                {[{ id: "", label: "未归档" }, ...interests.map((i) => ({
                  id: i.id,
                  label: interestFolderName(i),
                }))].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    tabIndex={0}
                    onClick={() => {
                      setEditDraft((prev) => ({ ...prev, research_interest_id: id }));
                      setEditFolderPickerOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors duration-100"
                    style={{
                      color: editDraft.research_interest_id === id ? "#007AFF" : "#1C1C1E",
                      background: editDraft.research_interest_id === id ? "rgba(0,122,255,0.08)" : "transparent",
                      fontWeight: editDraft.research_interest_id === id ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
                    background: editDraft.importance_color === color ? (color || "rgba(0,0,0,0.08)") : "#E8ECF0",
                    color: editDraft.importance_color === color && color ? "#fff" : "#666",
                    boxShadow: editDraft.importance_color === color
                      ? "inset 1px 1px 3px rgba(0,0,0,0.2)"
                      : "2px 2px 4px #C8CDD3, -2px -2px 4px #FFFFFF",
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
                background: "#E8ECF0",
                boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
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
          {paper.analysis && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-secondary tracking-wide">论文分析</p>
              {(
                [
                  ["研究问题", paper.analysis.research_question],
                  ["核心方法", paper.analysis.core_method],
                  ["实验设计", paper.analysis.experiment_design],
                  ["实验结果", paper.analysis.experiment_results],
                  ["创新点", paper.analysis.innovations],
                  ["局限性", paper.analysis.limitations],
                  ["关键结论", paper.analysis.key_conclusions],
                ] as [string, string | undefined][]
              )
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,0.025)" }}>
                    <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider">{label}</span>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-[1.7] text-ink-secondary">{value}</p>
                  </div>
                ))}
            </div>
          )}
          {paper.reproduction_guide && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-apple-blue tracking-wide">复现指南</p>
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
                  <div key={label} className="rounded-xl px-3 py-2" style={{ background: "rgba(0,122,255,0.04)" }}>
                    <span className="text-[11px] font-semibold text-apple-blue/70 uppercase tracking-wider">{label}</span>
                    {label === "代码仓库" ? (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {value!.split("\n").filter(Boolean).map((url) => (
                          <ExternalLink
                            key={url}
                            href={url.trim()}
                            className="text-xs text-apple-blue hover:underline break-all"
                          >
                            {url.trim()}
                          </ExternalLink>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-[1.7] text-ink-secondary">{value}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <style>{`
        @keyframes thinking-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">论文库</h1>
          <p className="mt-0.5 text-sm text-ink-tertiary">
            {`共 ${papers.length} 篇论文 · ${interests.length} 个主题分组`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
          {/* 自动更名开关 */}
          <button
            type="button"
            onClick={() => void handleToggleAutoRename()}
            className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-150 flex-shrink-0"
            style={{
              background: "#E8ECF0",
              boxShadow: autoRename
                ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
                : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
            }}
            title="导入后自动用提取的元数据重命名文件"
          >
            <span className={`text-xs font-medium transition-colors ${autoRename ? "text-apple-blue" : "text-ink-tertiary"}`}>
              自动更名
            </span>
            {/* pill track */}
            <div
              className="relative h-5 w-9 rounded-full transition-colors duration-200 flex-shrink-0"
              style={{ background: autoRename ? "#007AFF" : "#C8CDD3" }}
            >
              <div
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: autoRename ? "translateX(16px)" : "translateX(2px)" }}
              />
            </div>
          </button>

          <div
            className="relative min-w-[200px]"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setFolderPickerOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => setFolderPickerOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-sm text-ink-primary transition-all duration-150"
              style={{
                background: "#E8ECF0",
                boxShadow: folderPickerOpen
                  ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
                  : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
              }}
            >
              <span className="truncate">
                <span className="text-ink-tertiary">文件夹：</span>
                {selectedInterestId
                  ? interestFolderName(interests.find((i) => i.id === selectedInterestId)!)
                  : "未归档"}
              </span>
              <ChevronDown
                className="h-4 w-4 flex-shrink-0 text-ink-tertiary transition-transform duration-150"
                style={{ transform: folderPickerOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {folderPickerOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl py-1 overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #F2F6FA, #E8ECF0)",
                  boxShadow: "6px 6px 14px #C0C6CC, -4px -4px 10px #FFFFFF",
                }}
              >
                {[{ id: "", label: "未归档" }, ...interests.map((i) => ({
                  id: i.id,
                  label: interestFolderName(i),
                }))].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedInterestId(id);
                      setFolderPickerOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors duration-100"
                    style={{
                      color: selectedInterestId === id ? "#007AFF" : "#1C1C1E",
                      background: selectedInterestId === id ? "rgba(0,122,255,0.08)" : "transparent",
                      fontWeight: selectedInterestId === id ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleUpload} loading={uploading} size="md">
            <Upload className="w-4 h-4" />
            导入 PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "5px 5px 10px #C8CDD3, -5px -5px 10px #FFFFFF" }}
          >
            <Loader2 className="h-7 w-7 animate-spin text-apple-blue" />
          </div>
          <p className="text-sm text-ink-tertiary">加载中…</p>
        </div>
      ) : loadError ? (
        <Card className="flex flex-col items-center gap-4 py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <AlertCircle className="h-8 w-8 text-apple-red" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">无法连接后端</p>
            <p className="mt-1 break-all text-sm text-apple-red">{loadError}</p>
          </div>
        </Card>
      ) : papers.length === 0 && interests.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <FileText className="h-8 w-8 text-ink-tertiary" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">还没有论文</p>
            <p className="mt-1 text-sm text-ink-tertiary">上传 PDF，开始精读和分析。</p>
          </div>
        </Card>
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
                    {renderSortControl(group.key)}
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
                  这个方向下还没有论文，导入 PDF 后会显示在这里。
                </Card>
              ) : (
                group.papers.map(renderPaperCard)
              )}
            </CollapsibleGroup>
          ))}

          {ungroupedPapers.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-sm font-semibold text-ink-primary">未归档论文</p>
                  <p className="mt-0.5 text-xs text-ink-tertiary">这些论文暂未绑定主题，可直接编辑后移动到主题文件夹。</p>
                </div>
                {renderSortControl("ungrouped")}
              </div>
              {ungroupedPapers.map(renderPaperCard)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
