import { useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft } from "lucide-react";
import WritingToolbar from "./WritingToolbar";
import { useWritingPanelLayout } from "./useWritingPanelLayout";
import WritingAssistantPanel from "./WritingAssistantPanel";
import WritingDraftManagerModal from "./WritingDraftManagerModal";
import WritingEditorPanel from "./WritingEditorPanel";
import WritingLatexInstallNotice from "./WritingLatexInstallNotice";
import WritingLibraryStatus from "./WritingLibraryStatus";
import WritingNewDraftModal from "./WritingNewDraftModal";
import WritingPreviewPanel from "./WritingPreviewPanel";
import WritingSidebar from "./WritingSidebar";
import WritingVersionHistoryModal from "./WritingVersionHistoryModal";
import {
  isLatexCompilerMissing,
  type WritingAssistantActionId,
} from "./shared";
import { useWritingWorkspace } from "./useWritingWorkspace";
import "./writing-sidebar.css";

export default function WritingWorkspace({
  defaultResearchInterestId,
}: {
  defaultResearchInterestId?: string;
}) {
  const workspace = useWritingWorkspace();
  const showEditor = workspace.viewMode !== "preview";
  const showPreview = workspace.viewMode !== "editor";
  const showLatexInstallNotice = isLatexCompilerMissing(workspace.compileResult);
  const [draftManagerOpen, setDraftManagerOpen] = useState(false);
  const [newDraftModalOpen, setNewDraftModalOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { layoutRef, compact, sidebarCollapsed, setSidebarCollapsed } = useWritingPanelLayout(workspace.libraryReady);
  const [assistantRequest, setAssistantRequest] = useState<{
    actionId: WritingAssistantActionId;
    nonce: number;
    selectedText: string;
  } | null>(null);

  const handleAssistantAction = (actionId: WritingAssistantActionId) => {
    // 在动作触发瞬间（编辑器仍持有选区）抓取快照，避免焦点移到面板后选区丢失。
    const selectedText = workspace.getSelectedText();
    setAssistantOpen(true);
    setAssistantRequest((current) => ({ actionId, nonce: (current?.nonce ?? 0) + 1, selectedText }));
  };

  const libraryStatus = (
    <WritingLibraryStatus
      ready={workspace.libraryReady}
      status={workspace.saveStatus}
      error={workspace.libraryError}
      lastSavedAt={workspace.lastSavedAt}
      onRetryLoad={workspace.retryLoad}
      onRetrySave={() => { void workspace.retrySave(); }}
    />
  );

  if (!workspace.libraryReady) {
    return <div className="flex h-full items-center justify-center p-6 text-xs text-ink-tertiary">{libraryStatus}</div>;
  }

  return (
    <div ref={layoutRef} className="writing-workspace-frame">
      <div className="writing-workspace flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b px-4 py-3 app-header" style={{ borderColor: "var(--rc-border)", background: "var(--rc-header-bg)" }}>
        <WritingToolbar
          libraryStatus={libraryStatus}
          viewMode={workspace.viewMode}
          onViewModeChange={workspace.setViewMode}
          compileDraftId={workspace.compileDraftId}
          compileStatus={workspace.compileStatus}
          exportingTarget={workspace.exportingTarget}
          onNewDraft={() => setNewDraftModalOpen(true)}
          onManageDrafts={() => setDraftManagerOpen(true)}
          onImportFile={() => void workspace.importTexFile()}
          onImportProject={() => void workspace.importTexProject()}
          onCompile={() => void workspace.compilePdf()}
          onExport={(target) => void workspace.exportProject(target)}
        />

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

        {(workspace.recoverySummary.restored > 0 || workspace.recoverySummary.conflicts > 0) && (
          <p role="status" className="mt-2 text-xs text-apple-blue">
            已恢复 {workspace.recoverySummary.restored + workspace.recoverySummary.conflicts} 篇未保存文稿。
            {workspace.recoverySummary.conflicts > 0 && ` ${workspace.recoverySummary.conflicts} 篇文稿与后端内容冲突，已保留为“恢复副本”，请核对后再合并。`}
          </p>
        )}

        {showLatexInstallNotice ? (
          <div className="mt-3">
            <WritingLatexInstallNotice
              openingInstaller={workspace.latexInstallerStatus === "opening"}
              onDownloadInstaller={() => void workspace.openLatexInstaller()}
              onOpenInstallGuide={() => void workspace.openLatexDownloadPage()}
            />
          </div>
        ) : null}
      </header>

      <div
        className="relative grid min-h-0 flex-1 gap-3 px-4 py-3"
        style={{
          gridTemplateColumns:
            workspace.viewMode === "split"
              ? sidebarCollapsed || compact
                ? "minmax(0,1fr) minmax(0,1fr)"
                : "18rem minmax(0,1fr) 24rem"
              : workspace.viewMode === "editor"
                ? sidebarCollapsed || compact
                  ? "minmax(0,1fr)"
                  : "18rem minmax(0,1fr)"
                : "1fr",
        }}
      >
        {workspace.viewMode !== "preview" && !sidebarCollapsed && (
          <div className={clsx("min-h-0", compact ? "absolute bottom-3 left-4 top-3 z-20 w-72 rounded-2xl border" : "relative")}
            style={compact ? { background: "var(--rc-surface)", borderColor: "var(--rc-border)", boxShadow: "var(--rc-dropdown-menu-shadow)" } : undefined}>
            <WritingSidebar
              outline={workspace.outline}
              diagnostics={workspace.diagnostics}
              stats={workspace.stats}
              notes={workspace.notes}
              onJumpToLine={workspace.jumpToLine}
              onNotesChange={workspace.setNotes}
            />
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="收起侧栏"
              className="absolute -right-2 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border text-ink-tertiary transition-colors hover:text-ink-primary"
              style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-bg)" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {showEditor ? (
          <WritingEditorPanel
            editorRef={workspace.editorRef}
            mainTex={workspace.mainTex}
            bibtex={workspace.bibtex}
            texFiles={workspace.texFiles}
            imageAssets={workspace.imageAssets}
            activeSource={workspace.activeSource}
            onActiveSourceChange={workspace.setActiveSource}
            onSourceChange={workspace.updateSourceContent}
            onCreateTexFile={workspace.createTexFile}
            onRenameTexFile={workspace.renameTexFile}
            onDeleteTexFile={workspace.deleteTexFile}
            onInsertText={workspace.insertText}
            onInsertImage={workspace.insertImage}
            onAssistantAction={handleAssistantAction}
            onOpenVersionHistory={() => setVersionHistoryOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onExpandSidebar={() => setSidebarCollapsed(false)}
          />
        ) : null}

        {showPreview ? (
          <WritingPreviewPanel
            blocks={workspace.previewBlocks}
            compileResult={workspace.compileResult}
            compact={workspace.viewMode === "split"}
          />
        ) : null}
      </div>

      {workspace.compileResult && (
        <footer className="shrink-0 border-t px-4 py-2" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
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

      <WritingDraftManagerModal
        open={draftManagerOpen}
        drafts={workspace.drafts}
        activeDraftId={workspace.activeDraftId}
        projectName={workspace.projectName}
        researchInterestId={workspace.researchInterestId}
        interests={workspace.interests}
        loadingInterests={workspace.loadingInterests}
        interestError={workspace.interestError}
        templates={workspace.templates}
        templateId={workspace.templateId}
        onClose={() => setDraftManagerOpen(false)}
        onDraftChange={workspace.setActiveDraftId}
        onCreateDraft={() => setNewDraftModalOpen(true)}
        onDeleteDraft={workspace.deleteDraft}
        onProjectNameChange={workspace.setProjectName}
        onResearchInterestChange={workspace.setResearchInterestId}
        onTemplateChange={workspace.applyTemplate}
        onReset={workspace.resetWorkspace}
      />

      <WritingVersionHistoryModal
        open={versionHistoryOpen}
        projectName={workspace.projectName}
        versions={workspace.versionHistory.versions}
        loading={workspace.versionHistory.loadingVersions}
        preview={workspace.versionHistory.preview}
        previewLoading={workspace.versionHistory.previewLoading}
        error={workspace.versionHistory.error}
        onClose={() => setVersionHistoryOpen(false)}
        onRefresh={() => void workspace.versionHistory.refreshVersions()}
        onSelectVersion={(id) => void workspace.versionHistory.loadVersionPreview(id)}
        onRestore={(id) => workspace.versionHistory.restoreVersion(id)}
        onDelete={(id) => workspace.versionHistory.deleteVersion(id)}
        onRecordManual={() => workspace.versionHistory.recordManualVersion()}
      />

      <WritingNewDraftModal
        open={newDraftModalOpen}
        templates={workspace.templates}
        interests={workspace.interests}
        loadingInterests={workspace.loadingInterests}
        interestError={workspace.interestError}
        defaultResearchInterestId={defaultResearchInterestId ?? workspace.researchInterestId}
        defaultTemplateId={workspace.templateId}
        onClose={() => setNewDraftModalOpen(false)}
        onCreateDraft={workspace.createDraft}
      />

      <WritingAssistantPanel
        open={assistantOpen}
        projectName={workspace.projectName}
        mainTex={workspace.mainTex}
        bibtex={workspace.bibtex}
        texFiles={workspace.texFiles}
        notes={workspace.notes}
        outline={workspace.outline}
        diagnostics={workspace.diagnostics}
        stats={workspace.stats}
        onApplyText={workspace.insertGeneratedText}
        requestedAction={assistantRequest}
        onClose={() => setAssistantOpen(false)}
      />
      </div>
    </div>
  );
}
