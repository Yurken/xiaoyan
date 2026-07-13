import { useMemo } from "react";
import { AlertCircle, FileText, LayoutGrid, List, Loader2 } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { Paper, KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import NewFolderButton from "./NewFolderButton";
import PaperFolderSection, {
  CtxPaperCard,
  PaperGroupControls,
  type PaperFolderContext,
  type PaperGroup,
} from "./PaperFolderSection";
import { buildFolderSelectOptions, type InterestTreeNode } from "./interestTree";
import type { PaperSortDirection, PaperSortKey, PaperTaskProgress } from "./shared";
import type { NoteDraft } from "../knowledge/NoteEditorModal";
import { usePaperDisplayMode } from "./usePaperDisplayMode";

interface PapersListPanelProps {
  papers: Paper[];
  interests: ResearchInterest[];
  loading: boolean;
  loadError: string;
  deletingPaperId: string | null;
  deletingGroupId: string | null;
  savingEdit: boolean;
  folderForest: InterestTreeNode[];
  paperGroups: PaperGroup[];
  ungroupedPapers: Paper[];
  detailPaperId: string | null;
  taskProgressByPaperId: Record<string, PaperTaskProgress>;
  getSortKey: (groupId: string) => PaperSortKey;
  getSortDirection: (groupId: string) => PaperSortDirection;
  onAnalyze: (id: string) => void;
  onReproduce: (id: string) => void;
  onReparse: (id: string) => void;
  onUpdatePaper: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  onDeletePaper: (id: string) => void;
  onDeleteInterestGroup: (id: string, deleteAll: boolean) => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  interestMap: Record<string, ResearchInterest>;
  paperNotesMap: Record<string, KnowledgeNote>;
  onGenerateNote?: (paper: Paper) => Promise<KnowledgeNote>;
  onCreateNote?: (paper: Paper, draft: NoteDraft) => Promise<KnowledgeNote>;
  onSortKeyChange: (groupId: string, key: PaperSortKey) => void;
  onMovePaper?: (paperId: string, interestId: string | null) => void;
  onReorderPaper?: (groupId: string, orderedIds: string[]) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<unknown>;
  onMoveFolder: (id: string, parentId: string | null) => Promise<unknown>;
}

export function PapersListPanel(props: PapersListPanelProps) {
  const {
    papers, interests, interestMap, paperNotesMap, loading, loadError, deletingPaperId, deletingGroupId, savingEdit,
    folderForest, paperGroups, ungroupedPapers, detailPaperId, taskProgressByPaperId,
    getSortKey, getSortDirection,
    onAnalyze, onReproduce, onReparse, onUpdatePaper, onDeletePaper, onDeleteInterestGroup,
    onOpenDetail, onCloseDetail, onGenerateNote, onCreateNote, onSortKeyChange,
    onMovePaper, onReorderPaper, onCreateFolder, onMoveFolder,
  } = props;
  const [displayMode, setDisplayMode] = usePaperDisplayMode();

  const groupMap = useMemo(() => {
    const map = new Map<string, PaperGroup>();
    for (const group of paperGroups) map.set(group.key, group);
    return map;
  }, [paperGroups]);

  const folderOptions = useMemo(() => buildFolderSelectOptions(interests), [interests]);

  const resolveGroupPaperIds = (groupKey: string) =>
    (groupKey === "ungrouped" ? ungroupedPapers : groupMap.get(groupKey)?.papers ?? []).map((p) => p.id);

  const ctx: PaperFolderContext = {
    groupMap, interests, interestMap, paperNotesMap, folderOptions,
    detailPaperId, deletingPaperId, deletingGroupId, savingEdit, displayMode, taskProgressByPaperId,
    getSortKey, getSortDirection,
    onSortKeyChange,
    resolveGroupPaperIds,
    onAnalyze, onReproduce, onReparse, onUpdatePaper, onDeletePaper,
    onMovePaper, onReorderPaper,
    onOpenDetail, onCloseDetail, onGenerateNote, onCreateNote, onDeleteInterestGroup, onCreateFolder, onMoveFolder,
  };

  const hasLoadedContent = papers.length > 0 || interests.length > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <Loader2 className="h-7 w-7 animate-spin text-apple-blue" />
        </div>
        <p className="text-sm text-ink-tertiary">加载中…</p>
      </div>
    );
  }

  if (loadError && !hasLoadedContent) {
    return (
      <Card className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <AlertCircle className="h-8 w-8 text-apple-red" />
        </div>
        <div><p className="font-medium text-ink-secondary">加载失败</p><p className="mt-1 break-all text-sm text-apple-red">{loadError}</p></div>
      </Card>
    );
  }

  if (papers.length === 0 && interests.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <FileText className="h-8 w-8 text-ink-tertiary" />
        </div>
        <div><p className="font-medium text-ink-secondary">还没有论文</p><p className="mt-1 text-sm text-ink-tertiary">上传第一篇 PDF，或先建一个文件夹整理。</p></div>
        <NewFolderButton label="新建文件夹" onCreate={(name) => onCreateFolder(name, null)} />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-ink-tertiary">右键论文可移动到文件夹；文件夹支持子级整理。</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDisplayMode((mode) => (mode === "card" ? "minimal" : "card"))}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-ink-tertiary transition-colors hover:text-ink-primary"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
            title={displayMode === "card" ? "切换为极简展示" : "切换为卡片展示"}
            aria-label={displayMode === "card" ? "切换为极简展示" : "切换为卡片展示"}
          >
            {displayMode === "card" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            <span className="hidden sm:inline">{displayMode === "card" ? "极简展示" : "卡片展示"}</span>
          </button>
          <NewFolderButton label="新建文件夹" onCreate={(name) => onCreateFolder(name, null)} />
        </div>
      </div>

      {folderForest.map((node) => (
        <PaperFolderSection key={node.interest.id} node={node} ctx={ctx} />
      ))}

      {ungroupedPapers.length > 0 && (
        <section
          className="space-y-3 rounded-[24px] transition-shadow"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <p className="text-sm font-semibold text-ink-primary">未归档论文</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">暂未绑定文件夹，可从论文右键菜单移动归档。</p>
            </div>
            <PaperGroupControls
              groupKey="ungrouped"
              sortKey={getSortKey("ungrouped")}
              sortDirection={getSortDirection("ungrouped")}
              onSortKeyChange={onSortKeyChange}
            />
          </div>
          {ungroupedPapers.map((p) => <CtxPaperCard key={p.id} ctx={ctx} paper={p} groupKey="ungrouped" />)}
        </section>
      )}
    </div>
  );
}
