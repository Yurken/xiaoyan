import { useEffect, useState, type ReactNode } from "react";
import { FolderOpen, GitBranch, Search } from "lucide-react"; 
import { CapsuleTabs } from "@research-copilot/ui";
import CodeFileTree from "../code/CodeFileTree";
import CodeGitPanel from "../code/CodeGitPanel";
import CodeReviewPanel from "../code/CodeReviewPanel";
import type { DirEntry, OpenFile } from "../code/shared";
import type { useCodeGit } from "../code/useCodeGit";

type RightTab = "files" | "review" | "git";

const TAB_DEFS: { id: RightTab; label: string; icon: ReactNode }[] = [
  { id: "files", label: "文件", icon: <FolderOpen className="h-4 w-4" /> },
  { id: "review", label: "审查", icon: <Search className="h-4 w-4" /> },
  { id: "git", label: "Git", icon: <GitBranch className="h-4 w-4" /> },
];

interface ExperimentCodeToolsPanelProps {
  workingDir: string | null | undefined;
  width: number;
  fileSystem: {
    entries: DirEntry[];
    loading: boolean;
    listDir: (path: string) => Promise<DirEntry[]>;
  };
  openFile: OpenFile | null;
  onOpenFile: (path: string, name: string) => void;
  git: ReturnType<typeof useCodeGit>;
}

export function ExperimentCodeToolsPanel({
  workingDir,
  width,
  fileSystem,
  openFile,
  onOpenFile,
  git,
}: ExperimentCodeToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>("files");
  const { refresh } = git;

  useEffect(() => {
    void refresh();
  }, [activeTab, refresh]);

  return (
    <aside
      className="code-opencode-tools"
      aria-label="工具"
      style={{ width, minWidth: width }}
    >
      <div className="code-opencode-tabs">
        <CapsuleTabs
          compact
          display={width < 200 ? "icon" : width < 298 ? "text" : "full"}
          options={TAB_DEFS.map((tab) => ({ value: tab.id, label: tab.label, icon: tab.icon }))}
          value={activeTab}
          onChange={(value) => setActiveTab(value as RightTab)}
        />
      </div>

      <div className="code-opencode-tab-content">
        {activeTab === "files" && workingDir && (
          <CodeFileTree
            rootPath={workingDir}
            entries={fileSystem.entries}
            loading={fileSystem.loading}
            onListDir={fileSystem.listDir}
            onOpenFile={onOpenFile}
            activePath={openFile?.path ?? null}
            gitFiles={git.snapshot?.files}
          />
        )}
        {activeTab === "files" && !workingDir && (
          <div className="code-opencode-tab-placeholder">
            <FolderOpen size={24} />
            <p>请先选择工作目录</p>
          </div>
        )}
        {activeTab === "review" && (
          <CodeReviewPanel
            workingDir={workingDir}
            snapshot={git.snapshot}
            loading={git.loading}
            reviewing={git.reviewing}
            review={git.review}
            error={git.error}
            onRefresh={git.refresh}
            onRunReview={git.runReview}
          />
        )}
        {activeTab === "git" && (
          <CodeGitPanel
            workingDir={workingDir}
            snapshot={git.snapshot}
            loading={git.loading}
            actionLoading={git.actionLoading}
            generatingCommitMessage={git.generatingMessage}
            switchingBranch={git.switchingBranch}
            branches={git.branches}
            error={git.error}
            commitMessage={git.commitMessage}
            onCommitMessageChange={git.setCommitMessage}
            onRefresh={git.refresh}
            onStage={git.stage}
            onUnstage={git.unstage}
            onCommit={git.commit}
            onGenerateCommitMessage={git.generateCommitMessage}
            onLoadBranches={git.loadBranches}
            onCheckoutBranch={git.checkoutBranch}
            onOpenFile={onOpenFile}
            onDiscard={git.discard}
            onStageAll={git.stageAll}
            onUnstageAll={git.unstageAll}
          />
        )}
      </div>
    </aside>
  );
}
