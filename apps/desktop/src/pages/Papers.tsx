import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, FileDown, GitMerge, Upload } from "lucide-react";
import { safeOnDragDrop } from "../lib/tauriEvent";
import { Button, CapsuleTabs, Select } from "@research-copilot/ui";
import { useClickOutside } from "../hooks/useClickOutside";
import { usePapersList } from "../features/papers/usePapersList";
import { PapersListPanel } from "../features/papers/PapersListPanel";
import CorpusPanel from "../features/papers/CorpusPanel";
import MergeDuplicatesDialog from "../features/papers/MergeDuplicatesDialog";
import { findDuplicateGroups } from "../features/papers/duplicatePapers";
import PaperDetailModal from "../features/papers/PaperDetailModal";
import { usePaperDetailRoute } from "../features/papers/usePaperDetailRoute";
import { usePaperTaskProgress } from "../features/papers/usePaperTaskProgress";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { PaperFigure } from "../features/papers/shared";
import { buildFolderSelectOptions } from "../features/papers/interestTree";

export default function Papers({ hideFolders = false }: { hideFolders?: boolean }) {
  const papers = usePapersList();
  const [view, setView] = useState<"papers" | "corpus">("papers");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const [detailPaperId, setDetailPaperId] = useState<string | null>(null);
  const [paperFigures, setPaperFigures] = useState<Record<string, PaperFigure[]>>({});
  const [recognizeOpen, setRecognizeOpen] = useState(false);
  type RecognizeFlags = { title: boolean; authors: boolean; year: boolean; venue: boolean; keywords: boolean };
  const [recognizeFlags, setRecognizeFlags] = useState<RecognizeFlags>({
    title: true, authors: true, year: true, venue: true, keywords: true,
  });
  const recognizeRef = useClickOutside(recognizeOpen, () => setRecognizeOpen(false));
  const [fileDropActive, setFileDropActive] = useState(false);
  const dragDepthRef = useRef(0);
  const selectedInterestIdRef = useRef(papers.selectedInterestId);
  useEffect(() => { selectedInterestIdRef.current = papers.selectedInterestId; }, [papers.selectedInterestId]);

  // 拖拽 PDF 到窗口直接导入（路径由 Tauri onDragDropEvent 提供）
  const importPaths = papers.importPaths;
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;
    void safeOnDragDrop((event) => {
      if (event.payload.type === "drop") {
        dragDepthRef.current = 0;
        setFileDropActive(false);
        const pdfs = (event.payload.paths ?? []).filter((p) => p.toLowerCase().endsWith(".pdf"));
        if (pdfs.length > 0) void importPaths(pdfs, selectedInterestIdRef.current || undefined);
      } else if (event.payload.type === "leave") {
        dragDepthRef.current = 0;
        setFileDropActive(false);
      }
    }).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });
    return () => {
      mounted = false;
      unlisten?.();
      unlisten = undefined;
    };
  }, [importPaths]);

  const handlePageDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setFileDropActive(true);
  };
  const handlePageDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) { dragDepthRef.current = 0; setFileDropActive(false); }
  };
  const handlePageDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  };
  const { taskProgressByPaperId, markPaperTaskStarted, markPaperTaskFailed } = usePaperTaskProgress({
    setPapers: papers.setPapers,
    setError: papers.setLoadError,
  });

  useEffect(() => {
    apiClient.settings.get().then((settings) => {
      setRecognizeFlags({
        title: settings.paper_import_recognize_title !== "false",
        authors: settings.paper_import_recognize_authors !== "false",
        year: settings.paper_import_recognize_year !== "false",
        venue: settings.paper_import_recognize_venue !== "false",
        keywords: settings.paper_import_recognize_keywords !== "false",
      });
    }).catch((err) => { console.warn("Failed to load settings:", err); });
  }, []);

  const handleToggleRecognize = async (key: keyof RecognizeFlags) => {
    const next = { ...recognizeFlags, [key]: !recognizeFlags[key] };
    setRecognizeFlags(next);
    try {
      await apiClient.settings.update({ [`paper_import_recognize_${key}`]: next[key] ? "true" : "false" });
    } catch { setRecognizeFlags(recognizeFlags); }
  };

  const detailPaper = papers.papers.find((p) => p.id === detailPaperId) ?? null;
  const { closePaperDetail, openPaperDetail } = usePaperDetailRoute({
    papers: papers.papers, detailPaperId, setDetailPaperId,
  });

  useEffect(() => {
    if (!detailPaperId || paperFigures[detailPaperId] !== undefined) return;
    apiClient.papers.listFigures(detailPaperId).then((figs) => {
      setPaperFigures((prev) => ({ ...prev, [detailPaperId]: figs }));
    }).catch(() => { setPaperFigures((prev) => ({ ...prev, [detailPaperId]: [] })); });
  }, [detailPaperId, paperFigures]);

  const handleAnalyze = async (id: string) => {
    const paper = papers.papers.find((p) => p.id === id);
    if (paper) {
      markPaperTaskStarted(id, "analysis");
      void apiClient.memory.add({ type: "auto", action: "paper.analyze",
        summary: `触发小妍解读论文：《${paper.title}》`, detail: JSON.stringify({ paper_id: id }) });
    }
    try {
      await papers.handleAnalyze(id);
    } catch (error) {
      markPaperTaskFailed(id);
      papers.setLoadError(formatErrorMessage(error));
    }
  };

  const duplicateGroups = useMemo(() => findDuplicateGroups(papers.papers), [papers.papers]);

  const handleMerge = async (keepId: string, deleteIds: string[]) => {
    setMerging(true);
    try {
      await papers.handleMergePapers(keepId, deleteIds);
    } catch {
      // 错误已由 hook 写入 loadError
    } finally {
      setMerging(false);
    }
  };

  return (
    <div
      className="rc-app-page space-y-5"
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
    >
      {fileDropActive ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,122,255,0.08)", backdropFilter: "blur(1px)", pointerEvents: "none" }}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-12 py-10"
            style={{ borderColor: "#007AFF", background: "var(--rc-card-bg)" }}
          >
            <FileDown className="h-10 w-10 text-apple-blue" />
            <p className="text-base font-bold text-ink-primary">释放以导入 PDF</p>
            <p className="text-xs text-ink-tertiary">
              {papers.selectedInterestId ? "将归档到当前所选研究主题" : "导入为未归档论文"}
            </p>
          </div>
        </div>
      ) : null}

      <div className={clsx("mx-auto w-full space-y-5", hideFolders && "max-w-5xl px-4 pb-10")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">论文库</h1>
            <p className="mt-1 text-sm text-ink-tertiary">
              {`共 ${papers.papers.length} 篇论文 · ${papers.interests.length} 个主题分组`}
            </p>
            <p className="mt-1 text-sm text-ink-tertiary">
              上传 PDF，小妍会按论文类型精读内容；需要时可单独生成复现/验证指南。
            </p>
          </div>
          <div className={clsx("w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap", view === "papers" ? "flex" : "hidden")}>
            <div ref={recognizeRef} className="relative flex-shrink-0">
              <button type="button" onClick={() => setRecognizeOpen((v) => !v)} data-open={recognizeOpen}
                className="rc-dropdown-trigger flex items-center gap-1.5 rounded-2xl px-3 py-2 transition-all duration-150"
                title="导入时自动识别论文内容">
                <span className="text-xs font-medium text-ink-secondary">自动识别</span>
                <ChevronDown className={`w-3.5 h-3.5 text-ink-tertiary transition-transform ${recognizeOpen ? "rotate-180" : ""}`} />
              </button>
              {recognizeOpen && (
                <div className="rc-dropdown-menu absolute left-0 top-full mt-1.5 z-30 min-w-[160px] rounded-2xl py-2">
                  {(["title","authors","year","venue","keywords"] as (keyof RecognizeFlags)[]).map((key) => (
                    <button key={key} type="button" onClick={() => void handleToggleRecognize(key)}
                      className="w-full flex items-center gap-2.5 px-4 py-1.5 text-xs text-ink-primary hover:bg-white/40 transition-colors">
                      <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ background: recognizeFlags[key] ? "#007AFF" : "transparent",
                          border: recognizeFlags[key] ? "none" : "1.5px solid #B0B5BB" }}>
                        {recognizeFlags[key] && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                      {{ title: "名称", authors: "作者", year: "年份", venue: "期刊 / 会议", keywords: "关键词" }[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!hideFolders && (
              <Select className="min-w-[200px]" prefix="文件夹：" value={papers.selectedInterestId}
                onChange={papers.setSelectedInterestId}
                options={[{ value: "", label: "未归档" }, ...buildFolderSelectOptions(papers.interests)]} />
            )}
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMergeOpen(true)}
              disabled={duplicateGroups.length === 0}
              title={duplicateGroups.length === 0 ? "未发现重复论文" : "合并疑似重复的论文"}
            >
              <GitMerge className="w-4 h-4" />
              {duplicateGroups.length > 0 ? `合并重复 (${duplicateGroups.length})` : "合并重复"}
            </Button>
            <Button onClick={papers.handleUpload} loading={papers.uploading} size="md">
              <Upload className="w-4 h-4" />
              {papers.batchProgress ? `导入中 (${papers.batchProgress.done}/${papers.batchProgress.total})` : "导入 PDF"}
            </Button>
          </div>
        </div>

        <CapsuleTabs
          value={view}
          onChange={(v) => setView(v as "papers" | "corpus")}
          options={[
            { value: "papers", label: "论文库" },
            { value: "corpus", label: "语料库" },
          ]}
        />

        {view === "corpus" ? (
          <CorpusPanel />
        ) : (
        <PapersListPanel
          papers={papers.papers}
          interests={papers.interests}
          loading={papers.loading}
          loadError={papers.loadError}
          deletingPaperId={papers.deletingPaperId}
          deletingGroupId={papers.deletingGroupId}
          savingEdit={papers.savingEdit}
          folderForest={papers.folderForest}
          paperGroups={papers.paperGroups}
          ungroupedPapers={papers.ungroupedPapers}
          detailPaperId={detailPaperId}
          taskProgressByPaperId={taskProgressByPaperId}
          keywordFilters={papers.keywordFilters}
          titleFilters={papers.titleFilters}
          getSortKey={papers.getSortKey}
          onAnalyze={handleAnalyze}
          onReproduce={papers.handleReproduce}
          onReparse={papers.handleReparse}
          onUpdatePaper={papers.handleUpdatePaper}
          onDeletePaper={papers.handleDeletePaper}
          onDeleteInterestGroup={papers.handleDeleteInterestGroup}
          onOpenDetail={openPaperDetail}
          onCloseDetail={closePaperDetail}
          onSortKeyChange={papers.setSortKey}
          onKeywordFilterChange={papers.setKeywordFilter}
          onTitleFilterChange={papers.setTitleFilter}
          onMovePaper={(paperId, interestId) =>
            void papers.handleUpdatePaper(paperId, { research_interest_id: interestId || undefined })
          }
          onReorderPaper={(groupId, orderedIds) => void papers.handleReorderPaper(groupId, orderedIds)}
          onCreateFolder={papers.handleCreateFolder}
          onMoveFolder={papers.handleMoveFolder}
        />
        )}
      </div>
      <PaperDetailModal paper={detailPaper} figures={detailPaper ? (paperFigures[detailPaper.id] ?? []) : []}
        onClose={closePaperDetail} />
      {mergeOpen ? (
        <MergeDuplicatesDialog
          groups={duplicateGroups}
          busy={merging}
          onMerge={handleMerge}
          onClose={() => setMergeOpen(false)}
        />
      ) : null}
    </div>
  );
}
