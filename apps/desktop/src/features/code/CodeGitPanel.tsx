import {
  Check,
  ChevronDown,
  FilePlus,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  SquarePlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CodeGitSnapshot } from "../../lib/client";

interface CodeGitPanelProps {
  workingDir?: string | null;
  snapshot: CodeGitSnapshot | null;
  loading: boolean;
  actionLoading: boolean;
  generatingCommitMessage?: boolean;
  switchingBranch?: boolean;
  branches?: string[];
  error: string;
  commitMessage: string;
  onCommitMessageChange: (value: string) => void;
  onRefresh: () => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onCommit: () => void;
  onGenerateCommitMessage?: () => void;
  onLoadBranches?: () => void;
  onCheckoutBranch?: (branch: string) => void;
}

function statusLabel(file: CodeGitSnapshot["files"][number]) {
  if (file.untracked) return "未跟踪";
  if (file.index_status === "A" || file.worktree_status === "A") return "新增";
  if (file.index_status === "D" || file.worktree_status === "D") return "删除";
  if (file.index_status === "R" || file.worktree_status === "R") return "重命名";
  return "修改";
}

function diffPreview(snapshot: CodeGitSnapshot | null) {
  if (!snapshot) return "";
  return [snapshot.staged_diff, snapshot.unstaged_diff].filter(Boolean).join("\n");
}

export default function CodeGitPanel({
  workingDir,
  snapshot,
  loading,
  actionLoading,
  generatingCommitMessage,
  switchingBranch,
  branches = [],
  error,
  commitMessage,
  onCommitMessageChange,
  onRefresh,
  onStage,
  onUnstage,
  onCommit,
  onGenerateCommitMessage,
  onLoadBranches,
  onCheckoutBranch,
}: CodeGitPanelProps) {
  const diff = diffPreview(snapshot);
  const hasStaged = Boolean(snapshot?.files.some((file) => file.staged));
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!branchMenuOpen) return;
    onLoadBranches?.();
    function handlePointerDown(event: MouseEvent) {
      if (!branchMenuRef.current?.contains(event.target as Node)) {
        setBranchMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [branchMenuOpen, onLoadBranches]);

  if (!workingDir) {
    return (
      <div className="code-opencode-tab-placeholder">
        <GitBranch size={24} />
        <p>请先选择工作目录</p>
      </div>
    );
  }

  if (loading && !snapshot) {
    return (
      <div className="code-opencode-tab-placeholder">
        <Loader2 size={18} className="animate-spin" />
        <p>正在读取 Git 状态</p>
      </div>
    );
  }

  if (snapshot && !snapshot.is_repo) {
    return (
      <div className="code-opencode-tab-placeholder">
        <GitBranch size={24} />
        <p>当前目录不是 Git 仓库</p>
      </div>
    );
  }

  return (
    <div className="code-git-panel">
      <div className="code-git-panel__header">
        <div className="relative" ref={branchMenuRef}>
          <button
            type="button"
            className="code-git-panel__branch"
            onClick={() => setBranchMenuOpen((prev) => !prev)}
            disabled={switchingBranch}
            title="切换分支"
          >
            <GitBranch size={14} />
            <span>{snapshot?.branch ?? "unknown"}</span>
            {switchingBranch ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ChevronDown size={12} style={{ transform: branchMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            )}
            {snapshot?.head && <span className="code-git-panel__head">{snapshot.head}</span>}
          </button>
          {branchMenuOpen && (
            <div
              className="rc-dropdown-menu absolute top-full mt-1 left-0 z-20 min-w-[160px] max-h-60 overflow-y-auto rounded-2xl py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {branches.length === 0 ? (
                <div className="px-3 py-2 text-xs text-ink-tertiary">暂无分支</div>
              ) : (
                branches.map((branch) => {
                  const active = branch === snapshot?.branch;
                  return (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => {
                        if (!active) onCheckoutBranch?.(branch);
                        setBranchMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                      style={{
                        color: active ? "#007AFF" : "var(--rc-text-soft)",
                        background: active ? "rgba(0,122,255,0.08)" : "transparent",
                      }}
                      title={branch}
                    >
                      <GitBranch size={12} className="flex-shrink-0" />
                      <span className="truncate">{branch}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="code-mini-icon-btn"
          onClick={onRefresh}
          disabled={loading}
          title="刷新"
          aria-label="刷新 Git 状态"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      {(snapshot?.ahead || snapshot?.behind || snapshot?.upstream) && (
        <div className="code-git-panel__tracking">
          {snapshot.upstream && <span>{snapshot.upstream}</span>}
          {snapshot.ahead > 0 && <span>ahead {snapshot.ahead}</span>}
          {snapshot.behind > 0 && <span>behind {snapshot.behind}</span>}
        </div>
      )}

      <div className="code-git-panel__section">
        <div className="code-git-panel__section-title">
          <span>变更</span>
          <span>{snapshot?.files.length ?? 0}</span>
        </div>
        {error && <div className="code-git-panel__error">{error}</div>}
        {snapshot?.files.length ? (
          <div className="code-git-file-list">
            {snapshot.files.map((file) => (
              <div key={`${file.path}-${file.index_status}-${file.worktree_status}`} className="code-git-file">
                <div className="code-git-file__main">
                  <span className="code-git-file__status">{statusLabel(file)}</span>
                  <span className="code-git-file__path" title={file.path}>
                    {file.path}
                  </span>
                </div>
                <div className="code-git-file__actions">
                  {file.untracked && (
                    <button
                      type="button"
                      className="code-mini-icon-btn"
                      onClick={() => onStage(file.path)}
                      disabled={actionLoading}
                      title="添加"
                      aria-label={`添加 ${file.path}`}
                    >
                      <FilePlus size={13} />
                    </button>
                  )}
                  {!file.untracked && file.unstaged && (
                    <button
                      type="button"
                      className="code-mini-icon-btn"
                      onClick={() => onStage(file.path)}
                      disabled={actionLoading}
                      title="暂存"
                      aria-label={`暂存 ${file.path}`}
                    >
                      <SquarePlus size={13} />
                    </button>
                  )}
                  {file.staged && (
                    <button
                      type="button"
                      className="code-mini-icon-btn"
                      onClick={() => onUnstage(file.path)}
                      disabled={actionLoading}
                      title="取消暂存"
                      aria-label={`取消暂存 ${file.path}`}
                    >
                      <Minus size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="code-git-panel__empty">
            <Check size={14} />
            <span>工作区干净</span>
          </div>
        )}
      </div>

      <div className="code-git-panel__section">
        <div className="code-git-panel__section-title">
          <span>提交</span>
          {onGenerateCommitMessage && (
            <button
              type="button"
              className="code-git-link-btn"
              onClick={onGenerateCommitMessage}
              disabled={generatingCommitMessage || !hasStaged}
              title={
                hasStaged
                  ? "基于已暂存变更和最近提交样例生成提交注释"
                  : "请先暂存变更以生成注释"
              }
              aria-label="生成提交注释"
              style={{ padding: 3 }}
            >
              {generatingCommitMessage ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
            </button>
          )}
        </div>
        <textarea
          className="code-git-commit-input"
          value={commitMessage}
          onChange={(event) => onCommitMessageChange(event.target.value)}
          placeholder="feat: 描述这次改动"
          rows={3}
        />
        <button
          type="button"
          className="code-git-primary-btn"
          onClick={onCommit}
          disabled={!hasStaged || actionLoading || !commitMessage.trim()}
        >
          {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <GitCommitHorizontal size={13} />}
          <span>提交已暂存变更</span>
        </button>
      </div>

      <details className="code-git-diff" open={Boolean(diff)}>
        <summary>Diff 预览</summary>
        <DiffView diff={diff} />
      </details>
    </div>
  );
}

function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <div className="code-git-diff__empty">暂无 diff</div>;
  }

  const lines = diff.split("\n");
  return (
    <div className="code-git-diff__content">
      {lines.map((line, index) => {
        let className = "code-git-diff__line";
        let prefix = "";
        let content = line;

        if (line.startsWith("diff --git")) {
          className += " code-git-diff__line--file";
          const match = line.match(/diff --git a\/(.+) b\/(.+)/);
          content = match ? match[2] : line;
        } else if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("index ")) {
          className += " code-git-diff__line--meta";
        } else if (line.startsWith("@@")) {
          className += " code-git-diff__line--hunk";
        } else if (line.startsWith("+")) {
          className += " code-git-diff__line--add";
          prefix = "+";
          content = line.slice(1);
        } else if (line.startsWith("-")) {
          className += " code-git-diff__line--del";
          prefix = "-";
          content = line.slice(1);
        } else if (line.startsWith(" ")) {
          content = line.slice(1);
        }

        return (
          <div key={index} className={className}>
            <span className="code-git-diff__prefix">{prefix}</span>
            <span className="code-git-diff__text">{content}</span>
          </div>
        );
      })}
    </div>
  );
}
