import type { ReactNode } from "react";
import { Eye, FileText, FolderOpen, LayoutPanelLeft, PenLine, Plus, Upload } from "lucide-react";
import { Button, CapsuleTabs } from "@research-copilot/ui";
import WritingExportMenu from "./WritingExportMenu";
import WritingCompileButton from "./WritingCompileButton";
import type { WritingCompileStatus, WritingExportTarget, WritingViewMode } from "./shared";

const VIEW_OPTIONS = [
  { value: "split", label: "分栏", icon: <LayoutPanelLeft className="h-3.5 w-3.5" /> },
  { value: "editor", label: "源码", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "preview", label: "预览", icon: <Eye className="h-3.5 w-3.5" /> },
] as const;

interface WritingToolbarProps {
  libraryStatus: ReactNode;
  viewMode: WritingViewMode;
  compileDraftId: string;
  compileStatus: WritingCompileStatus;
  exportingTarget: WritingExportTarget | null;
  onViewModeChange: (mode: WritingViewMode) => void;
  onNewDraft: () => void;
  onManageDrafts: () => void;
  onImportFile: () => void;
  onImportProject: () => void;
  onCompile: () => void;
  onExport: (target: WritingExportTarget) => void;
}

export default function WritingToolbar({
  libraryStatus, viewMode, compileDraftId, compileStatus, exportingTarget, onViewModeChange,
  onNewDraft, onManageDrafts, onImportFile, onImportProject, onCompile, onExport,
}: WritingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 max-w-full items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue">
          <PenLine className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-ink-primary">论文撰写</h1>
          <div className="flex min-w-0 flex-wrap items-center gap-2 break-words text-xs text-ink-tertiary [overflow-wrap:anywhere]">
            {libraryStatus}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 [&_button]:shrink-0 [&_button]:whitespace-nowrap">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onNewDraft}
          title="新增文稿"
        >
          <Plus className="h-3.5 w-3.5" />
          新增文稿
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onManageDrafts}
          title="打开文稿管理"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          文稿管理
        </Button>

        <div>
          <CapsuleTabs
            value={viewMode}
            onChange={(v) => onViewModeChange(v as WritingViewMode)}
            options={VIEW_OPTIONS}
            compact
          />
        </div>

        <div className="flex flex-wrap items-center gap-2" style={{ borderColor: "var(--rc-border)" }}>
          <Button type="button" size="sm" variant="secondary" onClick={onImportFile} title="导入 .tex">
            <Upload className="h-3.5 w-3.5" />
            <span>导入</span>
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onImportProject} title="导入包含章节文件的 LaTeX 项目目录">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>导入项目</span>
          </Button>

          <div className="flex items-center gap-1 rounded-xl bg-apple-blue/5 p-1">
            <WritingCompileButton
              draftId={compileDraftId}
              compileStatus={compileStatus}
              exportingTarget={exportingTarget}
              onCompile={onCompile}
            />
          </div>

          <div className="ml-1 flex items-center gap-1.5">
            <WritingExportMenu
              exportingTarget={exportingTarget}
              onExport={onExport}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
