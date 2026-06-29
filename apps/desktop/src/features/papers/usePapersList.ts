import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { usePersistentState } from "../../hooks/usePersistentStringState";
import type { KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";
import { buildInterestForest, collectInterestSubtreeIds } from "./interestTree";
import { type PaperSortKey } from "./shared";
import type { NoteDraft } from "../knowledge/NoteEditorModal";

type SortKey = PaperSortKey;

const COLOR_PRIORITY = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE"];

export function usePapersList() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedInterestId, setSelectedInterestId] = usePersistentState<string>("rc:papers:selected-interest-id", "");
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [paperNotes, setPaperNotes] = useState<KnowledgeNote[]>([]);
  const [sortKeys, setSortKeys] = usePersistentState<Record<string, SortKey>>("rc:papers:sort-keys", {});
  const [keywordFilters, setKeywordFilters] = usePersistentState<Record<string, string>>("rc:papers:keyword-filters", {});
  const [titleFilters, setTitleFilters] = usePersistentState<Record<string, string>>("rc:papers:title-filters", {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    apiClient.papers.list(0, 500)
      .then((data) => { if (!cancelled) setPapers(data); })
      .catch((error) => { if (!cancelled) { setLoadError(formatErrorMessage(error)); setPapers([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient.knowledge.listNotesBySource("paper_note", "*")
      .then((data) => { if (!cancelled) setPaperNotes(data); })
      .catch(() => { if (!cancelled) setPaperNotes([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient.knowledge.listInterests()
      .then((data) => { if (!cancelled) setInterests(data); })
      .catch(() => { if (!cancelled) setInterests([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedInterestId || interests.length === 0) return;
    if (!interests.some((i) => i.id === selectedInterestId)) setSelectedInterestId("");
  }, [interests, selectedInterestId, setSelectedInterestId]);

  // 批量导入 PDF（对话框选择与拖拽导入共用）。interestId 为归档到的研究主题，留空则未归档。
  const importPaths = useCallback(async (paths: string[], interestId?: string) => {
    const pdfs = paths.filter((p) => p.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) return;
    try {
      setLoadError("");
      setUploading(true);
      setBatchProgress({ done: 0, total: pdfs.length });
      const failures: string[] = [];
      for (let i = 0; i < pdfs.length; i++) {
        try {
          await apiClient.papers.upload(pdfs[i], interestId || undefined);
        } catch (err) {
          failures.push(`${pdfs[i].split("/").pop() ?? pdfs[i]}：${formatErrorMessage(err)}`);
        }
        setBatchProgress({ done: i + 1, total: pdfs.length });
      }
      const updated = await apiClient.papers.list(0, 500);
      setPapers(updated);
      if (failures.length > 0) setLoadError(failures.join("\n"));
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setUploading(false);
      setBatchProgress(null);
    }
  }, []);

  const handleUpload = async () => {
    try {
      setLoadError("");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true, filters: [{ name: "PDF", extensions: ["pdf"] }] });
      if (!selected) return;
      const paths = (Array.isArray(selected) ? selected : [selected])
        .map((item) => typeof item === "string" ? item : (item && typeof item === "object" && "path" in item ? String((item as { path: unknown }).path) : ""))
        .filter(Boolean);
      if (paths.length === 0) return;
      await importPaths(paths, selectedInterestId || undefined);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  };

  const handleAnalyze = async (id: string) => {
    try {
      setLoadError("");
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "analyzing" } : p)));
      await apiClient.papers.analyze(id);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "failed" } : p)));
    }
  };

  const handleReproduce = async (id: string) => {
    try {
      setLoadError("");
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "analyzing" } : p)));
      await apiClient.papers.reproduce(id);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "failed" } : p)));
    }
  };

  // 重新解析 PDF：刷新正文与分块；后续 parsed/failed 状态由 paper:status 监听统一回填。
  const handleReparse = async (id: string) => {
    try {
      setLoadError("");
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "parsing" } : p)));
      await apiClient.papers.reparse(id);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "failed" } : p)));
    }
  };

  const handleUpdatePaper = async (id: string, data: Record<string, unknown>) => {
    try {
      setSavingEdit(true);
      setLoadError("");
      const updated = await apiClient.papers.update(id, data);
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      return updated;
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      throw error;
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateKnowledgeNote = async (paper: Paper, draft: NoteDraft) => {
    try {
      setLoadError("");
      const note = await apiClient.knowledge.createNote({
        title: draft.title.trim(),
        content: draft.content.trim(),
        tags: [],
        research_interest_id: draft.research_interest_id || paper.research_interest_id,
        source_type: "paper_note",
        source_id: paper.id,
      });
      setPaperNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
      void apiClient.memory.add({
        type: "auto",
        action: "paper.create_note",
        summary: `从论文「${paper.title}」创建了知识笔记「${note.title}」`,
        detail: JSON.stringify({ paper_id: paper.id, note_id: note.id }),
      });
      return note;
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      throw error;
    }
  };

  const handleGenerateNote = async (paper: Paper) => {
    try {
      setLoadError("");
      const note = await apiClient.papers.generateNote(paper.id);
      setPaperNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
      void apiClient.memory.add({
        type: "auto",
        action: "paper.generate_note",
        summary: `小妍为论文「${paper.title}」生成了知识笔记「${note.title}」`,
        detail: JSON.stringify({ paper_id: paper.id, note_id: note.id }),
      });
      return note;
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      throw error;
    }
  };

  const handleDeletePaper = async (id: string) => {
    try {
      setDeletingPaperId(id);
      setLoadError("");
      await apiClient.papers.delete(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setDeletingPaperId(null);
    }
  };

  // 合并重复论文：保留 keepId，关联数据并入后删除副本；后端返回合并后的主论文。
  const handleMergePapers = async (keepId: string, deleteIds: string[]) => {
    try {
      setLoadError("");
      const merged = await apiClient.papers.merge(keepId, deleteIds);
      setPapers((prev) =>
        prev.filter((p) => !deleteIds.includes(p.id)).map((p) => (p.id === keepId ? { ...p, ...merged } : p)),
      );
      return merged;
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      throw error;
    }
  };

  const handleCreateFolder = async (name: string, parentId?: string | null) => {
    try {
      setLoadError("");
      const created = await apiClient.knowledge.createFolder(name, parentId ?? null);
      setInterests((prev) => [created, ...prev]);
      return created;
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      throw error;
    }
  };

  const handleMoveFolder = async (id: string, parentId: string | null) => {
    try {
      setLoadError("");
      const updated = await apiClient.knowledge.moveInterest(id, parentId);
      setInterests((prev) => prev.map((i) => (i.id === id ? { ...i, parent_id: updated.parent_id } : i)));
      return updated;
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      throw error;
    }
  };

  const handleDeleteInterestGroup = async (interestId: string, deleteAll: boolean) => {
    try {
      setDeletingGroupId(interestId);
      setLoadError("");
      const subtreeIds = new Set(collectInterestSubtreeIds(interests, interestId));
      const fallbackParent = interests.find((i) => i.id === interestId)?.parent_id?.trim() || undefined;
      if (deleteAll) {
        await apiClient.knowledge.deleteInterestBundle(interestId);
        setPapers((prev) => prev.filter((p) => !(p.research_interest_id && subtreeIds.has(p.research_interest_id))));
        setInterests((prev) => prev.filter((i) => !subtreeIds.has(i.id)));
      } else {
        await apiClient.knowledge.deleteInterestOnly(interestId);
        // 仅删该层：直接论文与子文件夹上提到父级（无父级则未归档 / 顶层）。
        setPapers((prev) => prev.map((p) => (p.research_interest_id === interestId ? { ...p, research_interest_id: fallbackParent } : p)));
        setInterests((prev) => prev
          .filter((i) => i.id !== interestId)
          .map((i) => (i.parent_id === interestId ? { ...i, parent_id: fallbackParent } : i)));
      }
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setDeletingGroupId(null);
    }
  };


  const sortPapers = useCallback((ps: Paper[], key: SortKey): Paper[] => {
    if (key === "manual") return [...ps].sort((a, b) => {
      const ao = a.sort_order ?? 0;
      const bo = b.sort_order ?? 0;
      if (ao !== bo) return ao - bo;
      return b.created_at.localeCompare(a.created_at);
    });
    if (key === "title") return [...ps].sort((a, b) => a.title.localeCompare(b.title, "zh"));
    if (key === "importance") return [...ps].sort((a, b) => {
      const ai = a.importance_color ? COLOR_PRIORITY.indexOf(a.importance_color) : COLOR_PRIORITY.length;
      const bi = b.importance_color ? COLOR_PRIORITY.indexOf(b.importance_color) : COLOR_PRIORITY.length;
      return (ai === -1 ? COLOR_PRIORITY.length : ai) - (bi === -1 ? COLOR_PRIORITY.length : bi);
    });
    return [...ps].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, []);

  const getSortKey = useCallback((groupId: string): SortKey => sortKeys[groupId] || "created_at", [sortKeys]);
  const setSortKey = (groupId: string, key: SortKey) => setSortKeys((prev) => ({ ...prev, [groupId]: key }));

  const setKeywordFilter = (groupId: string, kw: string) => setKeywordFilters((prev) => ({ ...prev, [groupId]: kw }));
  const setTitleFilter = (groupId: string, q: string) => setTitleFilters((prev) => ({ ...prev, [groupId]: q }));

  // 文件夹内拖拽排序：orderedIds 为该文件夹论文的目标顺序。
  // 切换该分组为「自定义」排序，乐观更新本地 sort_order，再持久化到后端（随同步分发）。
  const handleReorderPaper = async (groupId: string, orderedIds: string[]) => {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    setSortKeys((prev) => ({ ...prev, [groupId]: "manual" }));
    setPapers((prev) => prev.map((p) => {
      const next = orderMap.get(p.id);
      return next === undefined ? p : { ...p, sort_order: next };
    }));
    try {
      setLoadError("");
      await apiClient.papers.reorder(orderedIds);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      const fresh = await apiClient.papers.list(0, 500).catch(() => null);
      if (fresh) setPapers(fresh);
    }
  };

  const interestMap = useMemo(() => Object.fromEntries(interests.map((i) => [i.id, i])), [interests]);
  const paperNotesMap = useMemo(() => {
    const map: Record<string, KnowledgeNote> = {};
    for (const note of paperNotes) {
      if (note.source_id && !(note.source_id in map)) {
        map[note.source_id] = note;
      }
    }
    return map;
  }, [paperNotes]);
  const folderForest = useMemo(() => buildInterestForest(interests), [interests]);

  const paperGroups = useMemo(() => {
    return interests.map((interest) => {
      const groupPapers = papers.filter((p) => p.research_interest_id === interest.id);
      const activeKw = keywordFilters[interest.id]?.toLowerCase();
      const activeTf = titleFilters[interest.id]?.toLowerCase();
      let filtered = activeKw ? groupPapers.filter((p) => p.tags?.some((tag) => tag.toLowerCase().includes(activeKw))) : groupPapers;
      if (activeTf) filtered = filtered.filter((p) => p.title.toLowerCase().includes(activeTf));
      return { key: interest.id, title: interest.folder_name?.trim() || interest.topic, subtitle: interest.topic, papers: sortPapers(filtered, getSortKey(interest.id)) };
    });
  }, [interests, papers, keywordFilters, titleFilters, getSortKey, sortPapers]);

  const ungroupedPapers = useMemo(() => {
    const base = papers.filter((p) => {
      if (!p.research_interest_id) return true;
      return !(p.research_interest_id in interestMap);
    });
    const activeKw = keywordFilters["ungrouped"]?.toLowerCase();
    const activeTf = titleFilters["ungrouped"]?.toLowerCase();
    let filtered = activeKw ? base.filter((p) => p.tags?.some((tag) => tag.toLowerCase().includes(activeKw))) : base;
    if (activeTf) filtered = filtered.filter((p) => p.title.toLowerCase().includes(activeTf));
    return sortPapers(filtered, getSortKey("ungrouped"));
  }, [papers, interestMap, keywordFilters, titleFilters, getSortKey, sortPapers]);

  return {
    papers, setPapers, interests, loading, uploading, batchProgress,
    loadError, setLoadError, deletingPaperId, savingEdit,
    selectedInterestId, setSelectedInterestId, deletingGroupId,
    sortKeys, getSortKey, setSortKey,
    keywordFilters, setKeywordFilter,
    titleFilters, setTitleFilter,
    paperGroups, ungroupedPapers, folderForest, interestMap, paperNotesMap,
    handleUpload, importPaths, handleAnalyze, handleReproduce, handleReparse,
    handleUpdatePaper, handleDeletePaper, handleMergePapers, handleDeleteInterestGroup, handleReorderPaper,
    handleCreateFolder, handleMoveFolder, handleCreateKnowledgeNote, handleGenerateNote,
  };
}
