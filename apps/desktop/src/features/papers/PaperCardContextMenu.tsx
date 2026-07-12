import { Check, ChevronRight, FolderInput, FolderOpen, Pencil, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Paper } from "@research-copilot/types";
import type { FolderSelectOption } from "./interestTree";
import { apiClient } from "../../lib/client";

interface PaperCardContextMenuProps {
  paper: Paper;
  x: number;
  y: number;
  folderOptions: FolderSelectOption[];
  onClose: () => void;
  onEdit: () => void;
  onReparse: (id: string) => void;
  onRequestDelete: () => void;
  onMovePaper?: (paperId: string, interestId: string | null) => void | Promise<unknown>;
}

export default function PaperCardContextMenu({
  paper,
  x,
  y,
  folderOptions,
  onClose,
  onEdit,
  onReparse,
  onRequestDelete,
  onMovePaper,
}: PaperCardContextMenuProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const moveOptions = [{ value: "", label: "未归档" }, ...folderOptions];

  return (
    <div
      data-no-drag="true"
      role="menu"
      className="fixed z-[60] min-w-[190px] overflow-visible rounded-2xl border p-1.5"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 440)),
        top: Math.max(8, Math.min(y, window.innerHeight - 260)),
        background: "var(--rc-dropdown-menu-bg)",
        borderColor: "var(--rc-dropdown-menu-border)",
        boxShadow: "var(--rc-dropdown-menu-shadow)",
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <Pencil className="h-3.5 w-3.5" />编辑
      </button>
      {onMovePaper ? (
        <div className="relative" onMouseEnter={() => setMoveOpen(true)} onMouseLeave={() => setMoveOpen(false)}>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={moveOpen}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30"
            onFocus={() => setMoveOpen(true)}
            onClick={() => setMoveOpen((open) => !open)}
          >
            <FolderInput className="h-3.5 w-3.5" />
            <span className="flex-1">移至文件夹</span>
            <ChevronRight className="h-3.5 w-3.5 text-ink-tertiary" />
          </button>
          {moveOpen ? (
            <div
              role="menu"
              className="absolute left-[calc(100%-2px)] top-0 max-h-72 min-w-[220px] overflow-y-auto rounded-2xl border p-1.5"
              style={{
                background: "var(--rc-dropdown-menu-bg)",
                borderColor: "var(--rc-dropdown-menu-border)",
                boxShadow: "var(--rc-dropdown-menu-shadow)",
              }}
            >
              {moveOptions.map((option) => {
                const active = (paper.research_interest_id ?? "") === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30"
                    style={{
                      background: active ? "color-mix(in srgb, var(--rc-accent) 10%, transparent)" : undefined,
                      color: active ? "var(--rc-accent)" : undefined,
                      fontWeight: active ? 600 : 400,
                    }}
                    onClick={() => {
                      void onMovePaper(paper.id, option.value || null);
                      onClose();
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {active ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {paper.file_path ? (
        <button
          type="button"
          role="menuitem"
          disabled={["parsing", "analyzing"].includes(paper.status)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30 disabled:opacity-40"
          onClick={() => {
            onReparse(paper.id);
            onClose();
          }}
        >
          <RotateCw className="h-3.5 w-3.5" />重新解析
        </button>
      ) : null}
      {paper.file_path ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30"
          onClick={() => {
            void apiClient.papers.revealInFolder(paper.id);
            onClose();
          }}
        >
          <FolderOpen className="h-3.5 w-3.5" />在访达中打开
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="mt-1 flex w-full items-center gap-2 rounded-xl border-t px-3 py-2 text-left text-sm text-apple-red transition-colors hover:bg-apple-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-red/30"
        style={{ borderColor: "var(--rc-border)" }}
        onClick={() => {
          onRequestDelete();
          onClose();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />删除
      </button>
    </div>
  );
}
