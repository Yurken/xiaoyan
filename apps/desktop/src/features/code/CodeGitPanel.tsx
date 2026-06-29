import {
  Check,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Minus,
  RefreshCw,
  SquarePlus,
} from "lucide-react";
import type { CodeGitSnapshot } from "../../lib/client";

interface CodeGitPanelProps {
  workingDir?: string | null;
  snapshot: CodeGitSnapshot | null;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  commitMessage: string;
  onCommitMessageChange: (value: string) => void;
  onRefresh: () => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onCommit: () => void;
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
  error,
  commitMessage,
  onCommitMessageChange,
  onRefresh,
  onStage,
  onUnstage,
  onCommit,
}: CodeGitPanelProps) {
  const diff = diffPreview(snapshot);
  const hasStaged = Boolean(snapshot?.files.some((file) => file.staged));

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
        <div className="code-git-panel__branch">
          <GitBranch size={14} />
          <span>{snapshot?.branch ?? "unknown"}</span>
          {snapshot?.head && <span className="code-git-panel__head">{snapshot.head}</span>}
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
                  {file.unstaged && (
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
        <pre>{diff || "暂无 diff"}</pre>
      </details>
    </div>
  );
}
