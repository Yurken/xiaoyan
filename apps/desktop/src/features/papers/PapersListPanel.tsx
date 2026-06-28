import { useMemo } from "react";
import { clsx } from "clsx";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { Paper, ResearchInterest } from "@research-copilot/types";
import NewFolderButton from "./NewFolderButton";
import PaperFolderSection, {
  CtxPaperCard,
  PaperGroupControls,
  type PaperFolderContext,
  type PaperGroup,
} from "./PaperFolderSection";
import { usePaperDnd } from "./usePaperDnd";
import { buildFolderSelectOptions, type InterestTreeNode } from "./interestTree";
import type { PaperSortKey, PaperTaskProgress } from "./shared";

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
  keywordFilters: Record<string, string>;
  titleFilters: Record<string, string>;
  getSortKey: (groupId: string) => PaperSortKey;
  onAnalyze: (id: string) => void;
  onReproduce: (id: string) => void;
  onReparse: (id: string) => void;
  onUpdatePaper: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  onDeletePaper: (id: string) => void;
  onDeleteInterestGroup: (id: string, deleteAll: boolean) => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onSortKeyChange: (groupId: string, key: PaperSortKey) => void;
  onKeywordFilterChange: (groupId: string, kw: string) => void;
  onTitleFilterChange: (groupId: string, q: string) => void;
  onMovePaper?: (paperId: string, interestId: string | null) => void;
  onReorderPaper?: (groupId: string, orderedIds: string[]) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<unknown>;
  onMoveFolder: (id: string, parentId: string | null) => Promise<unknown>;
}

export function PapersListPanel(props: PapersListPanelProps) {
  const {
    papers, interests, loading, loadError, deletingPaperId, deletingGroupId, savingEdit,
    folderForest, paperGroups, ungroupedPapers, detailPaperId, taskProgressByPaperId,
    keywordFilters, titleFilters, getSortKey,
    onAnalyze, onReproduce, onReparse, onUpdatePaper, onDeletePaper, onDeleteInterestGroup,
    onOpenDetail, onCloseDetail, onSortKeyChange, onKeywordFilterChange, onTitleFilterChange,
    onMovePaper, onReorderPaper, onCreateFolder, onMoveFolder,
  } = props;

  const groupMap = useMemo(() => {
    const map = new Map<string, PaperGroup>();
    for (const group of paperGroups) map.set(group.key, group);
    return map;
  }, [paperGroups]);

  const folderOptions = useMemo(() => buildFolderSelectOptions(interests), [interests]);

  const dnd = usePaperDnd({
    onMovePaper,
    onReorderPaper,
    resolveGroupPaperIds: (groupKey) =>
      (groupKey === "ungrouped" ? ungroupedPapers : groupMap.get(groupKey)?.papers ?? []).map((p) => p.id),
  });

  const ctx: PaperFolderContext = {
    groupMap, interests, folderOptions, dnd,
    canDragPaper: Boolean(onMovePaper || onReorderPaper),
    detailPaperId, deletingPaperId, deletingGroupId, savingEdit, taskProgressByPaperId,
    getSortKey, keywordFilters, titleFilters,
    onSortKeyChange, onKeywordFilterChange, onTitleFilterChange,
    onAnalyze, onReproduce, onReparse, onUpdatePaper, onDeletePaper,
    onOpenDetail, onCloseDetail, onDeleteInterestGroup, onCreateFolder, onMoveFolder,
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
        <p className="text-xs text-ink-tertiary">拖拽论文到文件夹归档，可建子文件夹分层整理。</p>
        <NewFolderButton label="新建文件夹" onCreate={(name) => onCreateFolder(name, null)} />
      </div>

      {folderForest.map((node) => (
        <PaperFolderSection key={node.interest.id} node={node} ctx={ctx} />
      ))}

      {ungroupedPapers.length > 0 && (
        <section
          {...dnd.folderDropProps("ungrouped", null)}
          className={clsx("space-y-3 rounded-[24px] transition-shadow", dnd.isFolderDragOver("ungrouped") && "shadow-[0_0_0_2px_var(--rc-accent)]")}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <p className="text-sm font-semibold text-ink-primary">未归档论文</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">暂未绑定文件夹，可拖拽到上方文件夹归档。</p>
            </div>
            <PaperGroupControls
              groupKey="ungrouped"
              sortKey={getSortKey("ungrouped")}
              keyword={keywordFilters["ungrouped"] ?? ""}
              titleQuery={titleFilters["ungrouped"] ?? ""}
              onSortKeyChange={onSortKeyChange}
              onKeywordFilterChange={onKeywordFilterChange}
              onTitleFilterChange={onTitleFilterChange}
            />
          </div>
          {ungroupedPapers.map((p) => <CtxPaperCard key={p.id} ctx={ctx} paper={p} groupKey="ungrouped" />)}
        </section>
      )}
    </div>
  );
}
