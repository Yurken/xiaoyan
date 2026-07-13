import { useState } from "react";
import { FolderInput, Trash2, X } from "lucide-react";
import { Button, Select } from "@research-copilot/ui";
import type { KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";
import CollapsibleGroup from "../../components/CollapsibleGroup";
import PaperCard from "./PaperCard";
import PaperCompactRow from "./PaperCompactRow";
import NewFolderButton from "./NewFolderButton";
import type { PaperDisplayMode, PaperSortDirection, PaperSortKey, PaperTaskProgress } from "./shared";
import type { NoteDraft } from "../knowledge/NoteEditorModal";
import type { FolderSelectOption, InterestTreeNode } from "./interestTree";
import { buildFolderSelectOptions, collectInterestSubtreeIds } from "./interestTree";
import { interestFolderName } from "../../lib/interestUtils";

export type PaperGroup = { key: string; title: string; subtitle: string; papers: Paper[] };

const SORT_KEYS: PaperSortKey[] = ["created_at", "title", "importance"];
const SORT_LABELS: Record<PaperSortKey, string> = { created_at: "导入时间", title: "名称", importance: "重要性", manual: "自定义" };
/** Direction-aware sort key labels for tooltips. */
const SORT_TOOLTIP_LABELS: Record<string, string> = { created_at: "导入时间", title: "名称", importance: "重要性" };

/** 递归文件夹节点渲染所需的共享上下文，自顶层一次构建后逐层透传。 */
export interface PaperFolderContext {
  groupMap: Map<string, PaperGroup>;
  interests: ResearchInterest[];
  interestMap: Record<string, ResearchInterest>;
  paperNotesMap: Record<string, KnowledgeNote>;
  folderOptions: FolderSelectOption[];
  detailPaperId: string | null;
  deletingPaperId: string | null;
  deletingGroupId: string | null;
  savingEdit: boolean;
  displayMode: PaperDisplayMode;
  taskProgressByPaperId: Record<string, PaperTaskProgress>;
  getSortKey: (groupId: string) => PaperSortKey;
  getSortDirection: (groupId: string) => PaperSortDirection;
  onSortKeyChange: (groupId: string, key: PaperSortKey) => void;
  resolveGroupPaperIds: (groupKey: string) => string[];
  onAnalyze: (id: string) => void;
  onReproduce: (id: string) => void;
  onReparse: (id: string) => void;
  onUpdatePaper: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  onMovePaper?: (paperId: string, interestId: string | null) => void | Promise<unknown>;
  onReorderPaper?: (groupId: string, orderedIds: string[]) => void;
  onDeletePaper: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onGenerateNote?: (paper: Paper) => Promise<KnowledgeNote>;
  onCreateNote?: (paper: Paper, draft: NoteDraft) => Promise<KnowledgeNote>;
  onDeleteInterestGroup: (id: string, deleteAll: boolean) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<unknown>;
  onMoveFolder: (id: string, parentId: string | null) => Promise<unknown>;
}

/** 文件夹/未归档区通用的排序控件。 */
export function PaperGroupControls({
  groupKey, sortKey, sortDirection,
  onSortKeyChange,
}: {
  groupKey: string;
  sortKey: PaperSortKey;
  sortDirection: PaperSortDirection;
  onSortKeyChange: (groupId: string, key: PaperSortKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {SORT_KEYS.map((key) => {
          const active = sortKey === key;
          const supportsDirection = key !== "manual";
          const isAscending = supportsDirection && active && sortDirection === "asc";
          const activeColor = !active ? undefined : isAscending ? "#34C759" : "#007AFF";
          const tooltip = supportsDirection && active
            ? `${SORT_TOOLTIP_LABELS[key]}${sortDirection === "asc" ? "正序" : "逆序"}`
            : undefined;
          return (
            <button key={key} type="button" onClick={(e) => { e.stopPropagation(); onSortKeyChange(groupKey, key); }}
              className="rounded-lg px-2 py-0.5 text-[10px] transition-all"
              title={tooltip}
              style={{ background: activeColor ?? "var(--rc-surface)", color: active ? "#fff" : "#999",
                boxShadow: active ? "inset 1px 1px 2px rgba(0,0,0,0.2)" : "var(--rc-chip-shadow)", fontWeight: active ? 600 : 400 }}>
              {SORT_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 用上下文渲染一张论文卡片，文件夹与未归档区共用，避免重复透传。 */
export function CtxPaperCard({ ctx, paper, groupKey }: { ctx: PaperFolderContext; paper: Paper; groupKey: string }) {
  const groupPaperIds = ctx.resolveGroupPaperIds(groupKey);
  const index = groupPaperIds.indexOf(paper.id);
  const sortable = Boolean(ctx.onReorderPaper && groupPaperIds.length > 1);
  const reorder = (direction: -1 | 1) => {
    if (!ctx.onReorderPaper || index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= groupPaperIds.length) return;
    const orderedIds = [...groupPaperIds];
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    ctx.onReorderPaper(groupKey, orderedIds);
  };

  if (ctx.displayMode === "minimal") {
    return (
      <PaperCompactRow
        paper={paper}
        detailPaperId={ctx.detailPaperId}
        onAnalyze={ctx.onAnalyze}
        onReproduce={ctx.onReproduce}
        onOpenDetail={ctx.onOpenDetail}
        onCloseDetail={ctx.onCloseDetail}
      />
    );
  }

  return (
    <PaperCard
      paper={paper}
      folderOptions={ctx.folderOptions}
      detailPaperId={ctx.detailPaperId}
      deletingPaperId={ctx.deletingPaperId}
      savingEdit={ctx.savingEdit}
      taskProgress={ctx.taskProgressByPaperId[paper.id]}
      interests={ctx.interests}
      interestMap={ctx.interestMap}
      paperNote={ctx.paperNotesMap[paper.id]}
      canMoveUp={sortable && index > 0}
      canMoveDown={sortable && index >= 0 && index < groupPaperIds.length - 1}
      onAnalyze={ctx.onAnalyze}
      onReproduce={ctx.onReproduce}
      onReparse={ctx.onReparse}
      onUpdatePaper={ctx.onUpdatePaper}
      onMovePaper={ctx.onMovePaper}
      onMoveUp={sortable ? () => reorder(-1) : undefined}
      onMoveDown={sortable ? () => reorder(1) : undefined}
      onDeletePaper={ctx.onDeletePaper}
      onOpenDetail={ctx.onOpenDetail}
      onCloseDetail={ctx.onCloseDetail}
      onGenerateNote={ctx.onGenerateNote}
      onCreateNote={ctx.onCreateNote}
    />
  );
}

export default function PaperFolderSection({ node, ctx }: { node: InterestTreeNode; ctx: PaperFolderContext }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [movingOpen, setMovingOpen] = useState(false);

  const interest = node.interest;
  const groupKey = interest.id;
  const group = ctx.groupMap.get(groupKey);
  const papers = group?.papers ?? [];
  const title = group?.title ?? interestFolderName(interest);
  const subtitle = group?.subtitle ?? interest.topic;

  // 移动目标：排除自身及其全部子孙（防环），并提供「顶层」。
  const subtreeSet = new Set(collectInterestSubtreeIds(ctx.interests, groupKey));
  const moveOptions = [
    { value: "", label: "顶层（无上级）" },
    ...buildFolderSelectOptions(ctx.interests).filter((opt) => !subtreeSet.has(opt.value)),
  ];

  return (
    <div className="rounded-[24px] transition-shadow">
      <CollapsibleGroup
        title={title}
        subtitle={subtitle !== title ? `研究主题：${subtitle}` : undefined}
        countLabel={`${papers.length} 篇`}
        defaultOpen={papers.length > 0 || node.children.length > 0}
        bodyClassName="space-y-3"
        actions={
          confirmDelete ? (
            <>
              <span className="text-xs text-ink-tertiary">删除文件夹：</span>
              <Button size="sm" variant="secondary" loading={ctx.deletingGroupId === groupKey}
                onClick={() => ctx.onDeleteInterestGroup(groupKey, false)}>仅删此层</Button>
              <Button size="sm" variant="secondary" loading={ctx.deletingGroupId === groupKey}
                onClick={() => ctx.onDeleteInterestGroup(groupKey, true)}>删除全部</Button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="text-ink-tertiary hover:text-ink-primary"><X className="h-3.5 w-3.5" /></button>
            </>
          ) : (
            <>
              <PaperGroupControls
                groupKey={groupKey}
                sortKey={ctx.getSortKey(groupKey)}
                sortDirection={ctx.getSortDirection(groupKey)}
                onSortKeyChange={ctx.onSortKeyChange}
              />
              <NewFolderButton label="子文件夹" onCreate={(name) => ctx.onCreateFolder(name, groupKey)} />
              <button type="button" onClick={(e) => { e.stopPropagation(); setMovingOpen((v) => !v); }}
                className="text-ink-tertiary/50 transition-colors hover:text-apple-blue" title="移动到其它文件夹">
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="text-ink-tertiary/40 transition-colors hover:text-apple-red"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )
        }
      >
        {movingOpen && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: "rgba(0,122,255,0.06)" }}>
            <Select className="min-w-[200px]" prefix="移动到：" value={interest.parent_id ?? ""}
              onChange={(value) => { void ctx.onMoveFolder(groupKey, value || null); setMovingOpen(false); }}
              options={moveOptions} />
            <button type="button" onClick={() => setMovingOpen(false)} className="text-xs text-ink-tertiary transition-colors hover:text-ink-primary">取消</button>
          </div>
        )}

        {papers.length === 0 && node.children.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-nm-dark/10 bg-white/25 py-8 text-center text-sm text-ink-tertiary">
            这个文件夹下还没有论文，上传 PDF 或在论文右键菜单中移动到这里。
          </div>
        ) : (
          papers.map((p) => <CtxPaperCard key={p.id} ctx={ctx} paper={p} groupKey={groupKey} />)
        )}

        {node.children.length > 0 && (
          <div className="space-y-3 border-l-2 border-nm-dark/10 pl-3">
            {node.children.map((child) => (
              <PaperFolderSection key={child.interest.id} node={child} ctx={ctx} />
            ))}
          </div>
        )}
      </CollapsibleGroup>
    </div>
  );
}
