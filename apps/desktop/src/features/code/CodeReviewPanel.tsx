import { AlertTriangle, ClipboardCheck, GitBranch, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { CodeGitSnapshot, CodeReviewReport } from "../../lib/client";
import CodeAssistantMessage from "./CodeAssistantMessage";

interface CodeReviewPanelProps {
  workingDir?: string | null;
  snapshot: CodeGitSnapshot | null;
  loading: boolean;
  reviewing: boolean;
  review: CodeReviewReport | null;
  error: string;
  onRefresh: () => void;
  onRunReview: () => void;
}

function hasDiff(snapshot: CodeGitSnapshot | null): boolean {
  return Boolean(
    snapshot?.files.length ||
      snapshot?.staged_diff.trim() ||
      snapshot?.unstaged_diff.trim(),
  );
}

export default function CodeReviewPanel({
  workingDir,
  snapshot,
  loading,
  reviewing,
  review,
  error,
  onRefresh,
  onRunReview,
}: CodeReviewPanelProps) {
  const canReview = Boolean(workingDir && snapshot?.is_repo && hasDiff(snapshot) && !reviewing);

  if (!workingDir) {
    return (
      <div className="code-opencode-tab-placeholder">
        <ClipboardCheck size={24} />
        <p>请先选择工作目录</p>
      </div>
    );
  }

  if (loading && !snapshot) {
    return (
      <div className="code-opencode-tab-placeholder">
        <Loader2 size={18} className="animate-spin" />
        <p>正在读取工作区变更</p>
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
    <div className="code-review-panel">
      <div className="code-review-panel__header">
        <div className="code-review-panel__title">
          <ClipboardCheck size={15} />
          <span>代码审查</span>
        </div>
        <button
          type="button"
          className="code-mini-icon-btn"
          onClick={onRefresh}
          disabled={loading || reviewing}
          title="刷新"
          aria-label="刷新 Git 状态"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      <div className="code-review-panel__summary">
        <span>{snapshot?.files.length ?? 0} 个变更文件</span>
        {snapshot?.branch && <span>{snapshot.branch}</span>}
      </div>

      {error && (
        <div className="code-review-panel__error">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {!hasDiff(snapshot) && (
        <div className="code-review-panel__empty">
          <Sparkles size={15} />
          <span>当前没有可审查的 diff</span>
        </div>
      )}

      <button
        type="button"
        className="code-git-primary-btn"
        onClick={onRunReview}
        disabled={!canReview}
      >
        {reviewing ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} />}
        <span>{reviewing ? "正在审查" : "审查当前变更"}</span>
      </button>

      {review && (
        <div className="code-review-panel__result">
          <div className="code-review-panel__result-meta">
            已审查约 {review.diff_chars.toLocaleString("zh-CN")} 字符 diff
          </div>
          <CodeAssistantMessage content={review.content} />
        </div>
      )}
    </div>
  );
}
