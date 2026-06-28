import { useState } from "react";
import type { DragEvent } from "react";

/**
 * 论文拖拽：跨文件夹移动（拖到另一个文件夹/未归档区）与文件夹内排序（拖到目标论文前/后）。
 * 文件夹层级展示后，每个文件夹节点与未归档区都是一个可放置的「分组」，groupKey 即 interest.id 或 "ungrouped"。
 */
export interface PaperDnd {
  isDragActive: boolean;
  draggingFromGroup: string | null;
  isFolderDragOver: (groupKey: string) => boolean;
  isDragging: (paperId: string) => boolean;
  dragInsertion: (paperId: string) => "before" | "after" | null;
  cardDragProps: (paperId: string, groupKey: string) => {
    onDragStart: (e: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
    onDragOver: (e: DragEvent<HTMLElement>) => void;
    onDrop: (e: DragEvent<HTMLElement>) => void;
  };
  folderDropProps: (groupKey: string, interestId: string | null) => {
    onDragOver: (e: DragEvent<HTMLElement>) => void;
    onDragEnter: (e: DragEvent<HTMLElement>) => void;
    onDragLeave: (e: DragEvent<HTMLElement>) => void;
    onDrop: (e: DragEvent<HTMLElement>) => void;
  };
}

interface UsePaperDndArgs {
  onMovePaper?: (paperId: string, interestId: string | null) => void;
  onReorderPaper?: (groupId: string, orderedIds: string[]) => void;
  /** 返回某分组当前展示顺序的论文 id 列表，用于排序计算。 */
  resolveGroupPaperIds: (groupKey: string) => string[];
}

export function usePaperDnd({ onMovePaper, onReorderPaper, resolveGroupPaperIds }: UsePaperDndArgs): PaperDnd {
  const [draggingPaperId, setDraggingPaperId] = useState<string | null>(null);
  const [draggingFromGroup, setDraggingFromGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [dragOverPaperId, setDragOverPaperId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before");

  const clearDrag = () => {
    setDraggingPaperId(null);
    setDraggingFromGroup(null);
    setDragOverGroup(null);
    setDragOverPaperId(null);
  };

  const handleDropToGroup = (interestId: string | null, groupKey: string) => {
    const paperId = draggingPaperId;
    const from = draggingFromGroup;
    clearDrag();
    if (!paperId || !onMovePaper || from === groupKey) return;
    onMovePaper(paperId, interestId);
  };

  // 文件夹内排序：把被拖论文插入到目标论文的前/后。
  const handleReorderDrop = (targetPaperId: string, groupKey: string) => {
    const paperId = draggingPaperId;
    const position = dropPosition;
    clearDrag();
    if (!paperId || !onReorderPaper || paperId === targetPaperId) return;
    const ids = [...resolveGroupPaperIds(groupKey)];
    const from = ids.indexOf(paperId);
    if (from < 0) return;
    ids.splice(from, 1);
    let to = ids.indexOf(targetPaperId);
    if (to < 0) return;
    if (position === "after") to += 1;
    ids.splice(to, 0, paperId);
    onReorderPaper(groupKey, ids);
  };

  return {
    isDragActive: draggingPaperId != null,
    draggingFromGroup,
    isFolderDragOver: (groupKey) => dragOverGroup === groupKey,
    isDragging: (paperId) => draggingPaperId === paperId,
    dragInsertion: (paperId) => (dragOverPaperId === paperId ? dropPosition : null),
    cardDragProps: (paperId, groupKey) => ({
      onDragStart: (e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button, a, input, textarea, select")) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", paperId);
        setDraggingPaperId(paperId);
        setDraggingFromGroup(groupKey);
      },
      onDragEnd: clearDrag,
      onDragOver: (e) => {
        // 仅处理同文件夹内的排序；跨文件夹移动交给分组容器。
        if (!draggingPaperId || !onReorderPaper) return;
        if (draggingFromGroup !== groupKey || draggingPaperId === paperId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        setDragOverPaperId(paperId);
        setDropPosition(after ? "after" : "before");
      },
      onDrop: (e) => {
        if (!draggingPaperId || !onReorderPaper || draggingFromGroup !== groupKey) return;
        e.preventDefault();
        e.stopPropagation();
        handleReorderDrop(paperId, groupKey);
      },
    }),
    folderDropProps: (groupKey, interestId) => ({
      // 拖拽进行中时由最内层文件夹「认领」事件（stopPropagation），避免嵌套文件夹的祖先误高亮或误接收。
      onDragOver: (e) => {
        if (!draggingPaperId) return;
        e.stopPropagation();
        if (draggingFromGroup === groupKey) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: (e) => {
        if (!draggingPaperId) return;
        e.stopPropagation();
        if (draggingFromGroup === groupKey) {
          setDragOverGroup((g) => (g === groupKey ? null : g));
          return;
        }
        e.preventDefault();
        setDragOverGroup(groupKey);
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOverGroup((g) => (g === groupKey ? null : g));
        }
      },
      onDrop: (e) => {
        if (!draggingPaperId) return;
        e.preventDefault();
        e.stopPropagation();
        handleDropToGroup(interestId, groupKey);
      },
    }),
  };
}
