import type { ReactNode } from "react";
import { LayoutGrid, List, Minus, Search } from "lucide-react";
import { CapsuleTabs, Input, Select } from "@research-copilot/ui";
import type { NotesViewMode } from "./notesShared";

interface SourceOption {
  value: string;
  label: string;
}

interface NotesFilterBarProps {
  sourceOptions: SourceOption[];
  sourceValue: string;
  onSourceChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: NotesViewMode;
  onViewModeChange: (value: NotesViewMode) => void;
  actions: ReactNode;
}

const VIEW_MODE_OPTIONS = [
  { value: "card", label: "卡片", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: "list", label: "列表", icon: <List className="h-3.5 w-3.5" /> },
  { value: "minimal", label: "极简", icon: <Minus className="h-3.5 w-3.5" /> },
] as const;

export default function NotesFilterBar({
  sourceOptions,
  sourceValue,
  onSourceChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  actions,
}: NotesFilterBarProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
      {sourceOptions.length > 0 ? (
        <Select
          aria-label="按来源筛选知识笔记"
          className="w-40 flex-shrink-0"
          prefix="来源："
          value={sourceValue}
          onChange={onSourceChange}
          options={sourceOptions}
        />
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative w-64 sm:w-72">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="请输入关键词搜索笔记、术语或方法"
            className="pl-10"
          />
        </div>
        <CapsuleTabs
          compact
          value={viewMode}
          onChange={(value) => onViewModeChange(value as NotesViewMode)}
          options={VIEW_MODE_OPTIONS}
        />
        {actions}
      </div>
    </div>
  );
}
