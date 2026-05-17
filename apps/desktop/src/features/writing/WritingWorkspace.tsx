import { clsx } from "clsx";
import {
  Archive,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  LayoutPanelLeft,
  Upload,
} from "lucide-react";
import { Button, CapsuleTabs } from "@research-copilot/ui";
import WritingEditorPanel from "./WritingEditorPanel";
import WritingLatexInstallNotice from "./WritingLatexInstallNotice";
import WritingPreviewPanel from "./WritingPreviewPanel";
import WritingSidebar from "./WritingSidebar";
import WritingSnippetToolbar from "./WritingSnippetToolbar";
import {
  isLatexCompilerMissing,
  type WritingExportTarget,
  type WritingViewMode,
} from "./shared";
import { useWritingWorkspace } from "./useWritingWorkspace";

const VIEW_OPTIONS = [
  { value: "split", label: "分栏", icon: <LayoutPanelLeft className="h-3.5 w-3.5" /> },
  { value: "editor", label: "源码", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "preview", label: "预览", icon: <Eye className="h-3.5 w-3.5" /> },
] as const;

const EXPORT_OPTIONS: Array<{ target: WritingExportTarget; label: string }> = [
  { target: "texstudio", label: "导出 TeXstudio" },
  { target: "overleaf", label: "导出 Overleaf" },
];

export default function WritingWorkspace() {
  const workspace = useWritingWorkspace();
  const showEditor = workspace.viewMode !== "preview";
  const showPreview = workspace.viewMode !== "editor";
  const showLatexInstallNotice = isLatexCompilerMissing(workspace.compileResult);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <header className="shrink-0 border-b px-6 py-4" style={{ borderColor: "var(--rc-border)", background: "var(--rc-header-bg)" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-ink-primary">论文撰写</h1>
              <div className="flex items-center gap-2 text-xs text-ink-tertiary">
                {workspace.lastSavedAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#34C759]" />
                    已自动保存 {workspace.lastSavedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : (
                  <span>正在准备自动保存...</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="mr-2">
              <CapsuleTabs
                value={workspace.viewMode}
                onChange={(v) => workspace.setViewMode(v as WritingViewMode)}
                options={VIEW_OPTIONS}
                compact
              />
            </div>

            <div className="flex items-center gap-2 border-l pl-3" style={{ borderColor: "var(--rc-border)" }}>
              <Button type="button" size="sm" variant="secondary" onClick={() => void workspace.importTexFile()} title="导入 .tex">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">导入</span>
              </Button>

              <div className="flex items-center gap-1 rounded-xl bg-apple-blue/5 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => void workspace.compilePdf()}
                  loading={workspace.compileStatus === "compiling"}
                  disabled={workspace.exportingTarget !== null}
                  className="shadow-sm"
                >
                  {workspace.compileStatus !== "compiling" ? (
                    <FileCheck2 className="h-3.5 w-3.5" />
                  ) : null}
                  编译 PDF
                </Button>

              </div>

              <div className="ml-1 flex items-center gap-1.5">
                {EXPORT_OPTIONS.map((option) => (
                  <Button
                    key={option.target}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void workspace.exportProject(option.target)}
                    loading={workspace.exportingTarget === option.target}
                    disabled={workspace.exportingTarget !== null}
                    className="px-2.5"
                  >
                    <Archive className="h-3.5 w-3.5 text-ink-tertiary" />
                    <span className="hidden xl:inline">{option.label.replace("导出 ", "")}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <WritingSnippetToolbar
            snippets={workspace.snippets}
            onInsertSnippet={workspace.insertSnippet}
          />
        </div>

        {(workspace.message || workspace.error) && (
          <div
            className={clsx(
              "mt-3 rounded-xl px-3 py-2 text-xs leading-5",
              workspace.error ? "text-apple-red" : "text-apple-blue",
            )}
            style={{
              background: workspace.error ? "rgba(255,59,48,0.08)" : "rgba(0,122,255,0.08)",
            }}
          >
            {workspace.error || workspace.message}
          </div>
        )}

        {showLatexInstallNotice ? (
          <div className="mt-3">
            <WritingLatexInstallNotice
              openingInstaller={workspace.latexInstallerStatus === "opening"}
              onDownloadInstaller={() => void workspace.openLatexInstaller()}
              onOpenDownloadPage={() => void workspace.openLatexDownloadPage()}
            />
          </div>
        ) : null}
      </header>

      <div
        className={clsx(
          "grid min-h-0 flex-1 gap-4 px-6 py-5",
          workspace.viewMode === "split"
            ? "grid-cols-[18rem_minmax(0,1fr)_24rem]"
            : workspace.viewMode === "editor"
              ? "grid-cols-[18rem_minmax(0,1fr)]"
              : "grid-cols-[1fr]",
        )}
      >
        {workspace.viewMode !== "preview" && (
          <WritingSidebar
            projectName={workspace.projectName}
            templates={workspace.templates}
            templateId={workspace.templateId}
            outline={workspace.outline}
            diagnostics={workspace.diagnostics}
            stats={workspace.stats}
            notes={workspace.notes}
            onProjectNameChange={workspace.setProjectName}
            onTemplateChange={workspace.applyTemplate}
            onJumpToLine={workspace.jumpToLine}
            onNotesChange={workspace.setNotes}
            onReset={workspace.resetWorkspace}
          />
        )}

        {showEditor ? (
          <WritingEditorPanel
            editorRef={workspace.editorRef}
            mainTex={workspace.mainTex}
            bibtex={workspace.bibtex}
            activeSource={workspace.activeSource}
            onActiveSourceChange={workspace.setActiveSource}
            onMainTexChange={workspace.setMainTex}
            onBibtexChange={workspace.setBibtex}
            onInsertText={workspace.insertText}
          />
        ) : null}

        {showPreview ? (
          <WritingPreviewPanel
            blocks={workspace.previewBlocks}
            source={workspace.mainTex}
            compileResult={workspace.compileResult}
            compact={workspace.viewMode === "split"}
          />
        ) : null}
      </div>

      {workspace.compileResult && (
        <footer className="shrink-0 border-t px-6 py-2" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-ink-tertiary hover:text-ink-secondary">
              <div className={clsx("h-1.5 w-1.5 rounded-full", workspace.compileResult.success ? "bg-[#34C759]" : "bg-apple-red")} />
              编译日志 ({workspace.compileResult.engine}) · {workspace.compileResult.success ? "成功" : "失败"}
              <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">点击查看详细信息</span>
            </summary>
            <pre className="rc-selectable mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-2 font-mono text-[10px] leading-4 text-ink-tertiary">
              {workspace.compileResult.log || "没有编译日志。"}
            </pre>
          </details>
        </footer>
      )}
    </div>
  );
}
