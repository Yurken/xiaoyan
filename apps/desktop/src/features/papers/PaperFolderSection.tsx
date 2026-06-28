import { useState } from "react";
import { clsx } from "clsx";
import { FolderInput, Trash2, X } from "lucide-react";
import { Button, Select } from "@research-copilot/ui";
import type { KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";
import CollapsibleGroup from "../../components/CollapsibleGroup";
import PaperCard from "./PaperCard";
import NewFolderButton from "./NewFolderButton";
import type { PaperDnd } from "./usePaperDnd";
import type { PaperSortKey, PaperTaskProgress } from "./shared";
import type { NoteDraft } from "../knowledge/NoteEditorModal";
import type { FolderSelectOption, InterestTreeNode } from "./interestTree";
import { buildFolderSelectOptions, collectInterestSubtreeIds } from "./interestTree";
import { interestFolderName } from "../../lib/interestUtils";

export type PaperGroup = { key: string; title: string; subtitle: string; papers: Paper[] };

const SORT_KEYS: PaperSortKey[] = ["created_at", "title", "importance", "manual"];
const SORT_LABELS: Record<PaperSortKey, string> = { created_at: "导入时间", title: "名称", importance: "重要性", manual: "自定义" };

const inputStyle = (active: boolean) => ({
  background: active ? "rgba(0,122,255,0.1)" : "var(--rc-surface)",
  color: active ? "#007AFF" : "#8E8E93",
  fontWeight: active ? 600 : 400,
  boxShadow: active ? "inset 1px 1px 2px rgba(0,122,255,0.15)" : "var(--rc-chip-shadow)",
});

/** 递归文件夹节点渲染所需的共享上下文，自顶层一次构建后逐层透传。 */
export interface PaperFolderContext {
  groupMap: Map<string, PaperGroup>;
  interests: ResearchInterest[];
  interestMap: Record<string, ResearchInterest>;
  paperNotesMap: Record<string, KnowledgeNote>;
  folderOptions: FolderSelectOption[];
  dnd: PaperDnd;
  canDragPaper: boolean;
  detailPaperId: string | null;
  deletingPaperId: string | null;
  deletingGroupId: string | null;
  savingEdit: boolean;
  taskProgressByPaperId: Record<string, PaperTaskProgress>;
  getSortKey: (groupId: string) => PaperSortKey;
  keywordFilters: Record<string, string>;
  titleFilters: Record<string, string>;
  onSortKeyChange: (groupId: string, key: PaperSortKey) => void;
  onKeywordFilterChange: (groupId: string, kw: string) => void;
  onTitleFilterChange: (groupId: string, q: string) => void;
  onAnalyze: (id: string) => void;
  onReproduce: (id: string) => void;
  onReparse: (id: string) => void;
  onUpdatePaper: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  onDeletePaper: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onGenerateNote?: (paper: Paper) => Promise<KnowledgeNote>;
  onCreateNote?: (paper: Paper, draft: NoteDraft) => Promise<KnowledgeNote>;
  onDeleteInterestGroup: (id: string, deleteAll: boolean) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<unknown>;
  onMoveFolder: (id: string, parentId: string | null) => Promise<unknown>;
}

/** 文件夹/未归档区通用的搜索 + 标签过滤 + 排序控件。 */
export function PaperGroupControls({
  groupKey, sortKey, keyword, titleQuery,
  onSortKeyChange, onKeywordFilterChange, onTitleFilterChange,
}: {
  groupKey: string;
  sortKey: PaperSortKey;
  keyword: string;
  titleQuery: string;
  onSortKeyChange: (groupId: string, key: PaperSortKey) => void;
  onKeywordFilterChange: (groupId: string, kw: string) => void;
  onTitleFilterChange: (groupId: string, q: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="text" value={titleQuery} placeholder="搜索标题" onClick={(e) => e.stopPropagation()}
        onChange={(e) => { e.stopPropagation(); onTitleFilterChange(groupKey, e.target.value); }}
        className="rounded-lg px-2 py-0.5 text-[10px] outline-none border-none w-20" style={inputStyle(!!titleQuery)} />
      <input type="text" value={keyword} placeholder="标签过滤" onClick={(e) => e.stopPropagation()}
        onChange={(e) => { e.stopPropagation(); onKeywordFilterChange(groupKey, e.target.value); }}
        className="rounded-lg px-2 py-0.5 text-[10px] outline-none border-none w-20" style={inputStyle(!!keyword)} />
      <div className="flex items-center gap-1">
        {SORT_KEYS.map((key) => {
          const active = sortKey === key;
          return (
            <button key={key} type="button" onClick={(e) => { e.stopPropagation(); onSortKeyChange(groupKey, key); }}
              className="rounded-lg px-2 py-0.5 text-[10px] transition-all"
              style={{ background: active ? "#007AFF" : "var(--rc-surface)", color: active ? "#fff" : "#999",
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
  return (
    <PaperCard
      paper={paper}
      groupKey={groupKey}
      folderOptions={ctx.folderOptions}
      detailPaperId={ctx.detailPaperId}
      deletingPaperId={ctx.deletingPaperId}
      savingEdit={ctx.savingEdit}
      taskProgress={ctx.taskProgressByPaperId[paper.id]}
      draggable={ctx.canDragPaper}
      dnd={ctx.dnd}
      interests={ctx.interests}
      interestMap={ctx.interestMap}
      paperNote={ctx.paperNotesMap[paper.id]}
      onAnalyze={ctx.onAnalyze}
      onReproduce={ctx.onReproduce}
      onReparse={ctx.onReparse}
      onUpdatePaper={ctx.onUpdatePaper}
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
    <div
      {...ctx.dnd.folderDropProps(groupKey, groupKey)}
      className={clsx("rounded-[24px] transition-shadow", ctx.dnd.isFolderDragOver(groupKey) && "shadow-[0_0_0_2px_var(--rc-accent)]")}
    >
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
                keyword={ctx.keywordFilters[groupKey] ?? ""}
                titleQuery={ctx.titleFilters[groupKey] ?? ""}
                onSortKeyChange={ctx.onSortKeyChange}
                onKeywordFilterChange={ctx.onKeywordFilterChange}
                onTitleFilterChange={ctx.onTitleFilterChange}
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
            这个文件夹下还没有论文，上传 PDF 或把论文拖进来。
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
