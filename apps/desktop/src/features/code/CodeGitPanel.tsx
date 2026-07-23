import {
  Check,
  ChevronDown,
  FilePlus,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Minus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  SquarePlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  /** 在应用内编辑器打开文件（绝对路径 + 文件名 + 可选 diff）。 */
  onOpenFile?: (path: string, name: string, diffContent?: string) => void;
  /** 放弃单个文件的工作区改动。 */
  onDiscard?: (path: string) => void;
  /** 暂存所有未暂存/未跟踪文件。 */
  onStageAll?: (paths: string[]) => void;
  /** 取消暂存所有已暂存文件。 */
  onUnstageAll?: (paths: string[]) => void;
}

function statusCode(file: CodeGitSnapshot["files"][number]): {
  letter: string;
  title: string;
} {
  // VSCode 风格：单字母 + 颜色色块，比中文标签"修改/新增/删除"更紧凑易扫。
  if (file.untracked) return { letter: "U", title: "未跟踪" };
  if (file.index_status === "A" || file.worktree_status === "A")
    return { letter: "A", title: "新增" };
  if (file.index_status === "D" || file.worktree_status === "D")
    return { letter: "D", title: "删除" };
  if (file.index_status === "R" || file.worktree_status === "R")
    return { letter: "R", title: "重命名" };
  return { letter: "M", title: "修改" };
}

/** 从聚合 diff 中提取某个文件的 diff 片段。 */
function extractFileDiff(snapshot: CodeGitSnapshot | null, filePath: string): string {
  if (!snapshot) return "";
  const combined = [snapshot.staged_diff, snapshot.unstaged_diff].filter(Boolean).join("\n");
  if (!combined) return "";

  // 按 diff --git 头部分块，重建每个文件段落
  const blocks = combined.split(/\ndiff --git a\//);
  const normalized = combined.startsWith("diff --git a/") ? blocks : blocks.slice(1);

  for (const block of normalized) {
    const fullBlock = "diff --git a/" + block;
    const headerEnd = block.indexOf("\n");
    const headerLine = headerEnd >= 0 ? block.slice(0, headerEnd) : block;
    // headerLine 形如 "path b/path" 或 "old b/new rename from old rename to new"
    const match = headerLine.match(/^(.+?) b\/(.+?)(?:\s|$)/);
    if (!match) continue;
    const [, oldPath, newPath] = match;
    if (oldPath === filePath || newPath === filePath) {
      return fullBlock;
    }
  }
  return "";
}

/** 统计 diff 中新增和删除的行数（排除 --- / +++ header 行）。 */
function countDiffLines(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++ ")) added++;
    else if (line.startsWith("-") && !line.startsWith("--- ")) removed++;
  }
  return { added, removed };
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
  onOpenFile,
  onDiscard,
  onStageAll,
  onUnstageAll,
}: CodeGitPanelProps) {
  const hasStaged = Boolean(snapshot?.files.some((file) => file.staged));
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchMenuRef = useRef<HTMLDivElement>(null);
  // 待确认放弃更改的文件路径。null = 不显示确认条；非空 = 显示。
  const [pendingDiscard, setPendingDiscard] = useState<string | null>(null);

  // 预计算每个文件的 diff，避免重复解析
  const fileDiffs = useMemo(() => {
    const map = new Map<string, string>();
    if (!snapshot) return map;
    for (const file of snapshot.files) {
      const diff = extractFileDiff(snapshot, file.path);
      if (diff) map.set(file.path, diff);
    }
    return map;
  }, [snapshot]);

  const stageablePaths = useMemo(
    () => snapshot?.files.filter((f) => f.untracked || f.unstaged).map((f) => f.path) ?? [],
    [snapshot],
  );

  const unstageablePaths = useMemo(
    () => snapshot?.files.filter((f) => f.staged).map((f) => f.path) ?? [],
    [snapshot],
  );

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

      {/* 提交区 —— 移到变更列表上方 */}
      <div className="code-git-panel__section">
        <div className="code-git-panel__section-title">
          <span>提交</span>
          <div className="code-git-panel__section-actions">
            {onStageAll && stageablePaths.length > 0 && (
              <button
                type="button"
                className="code-mini-icon-btn"
                onClick={() => onStageAll(stageablePaths)}
                disabled={actionLoading}
                title="全部暂存"
                aria-label="全部暂存"
              >
                <SquarePlus size={13} />
              </button>
            )}
            {onUnstageAll && unstageablePaths.length > 0 && (
              <button
                type="button"
                className="code-mini-icon-btn"
                onClick={() => onUnstageAll(unstageablePaths)}
                disabled={actionLoading}
                title="全部取消暂存"
                aria-label="全部取消暂存"
              >
                <Minus size={13} />
              </button>
            )}
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

      {/* 变更列表 */}
      <div className="code-git-panel__section">
        <div className="code-git-panel__section-title">
          <span>变更</span>
          <span>{snapshot?.files.length ?? 0}</span>
        </div>
        {error && <div className="code-git-panel__error">{error}</div>}
        {snapshot?.files.length ? (
          <div className="code-git-file-list">
            {snapshot.files.map((file) => {
              const code = statusCode(file);
              const isConfirming = pendingDiscard === file.path;
              const fileDiff = fileDiffs.get(file.path) ?? "";
              const diffStats = fileDiff ? countDiffLines(fileDiff) : null;
              return (
                <div
                  key={`${file.path}-${file.index_status}-${file.worktree_status}`}
                  className={`code-git-file${isConfirming ? " is-confirming" : ""}`}
                >
                  <div className="code-git-file__main">
                    <span
                      className="code-git-file__status"
                      data-status={code.letter}
                      title={code.title}
                      aria-label={code.title}
                    >
                      {code.letter}
                    </span>
                    <button
                      type="button"
                      className="code-git-file__path-btn"
                      onClick={() => {
                        if (!workingDir || !onOpenFile) return;
                        const absolute = workingDir.replace(/[\\/]+$/, "") + "/" + file.path;
                        const name = file.path.split("/").pop() || file.path;
                        onOpenFile(absolute, name, fileDiff || undefined);
                      }}
                      disabled={!onOpenFile}
                      title={onOpenFile ? "在编辑器中打开" : "未提供打开文件能力"}
                      aria-label={`打开 ${file.path}`}
                    >
                      {file.path}
                    </button>
                    {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
                      <span className="code-git-file__diff-stats">
                        {diffStats.added > 0 && (
                          <span className="code-git-file__diff-add">+{diffStats.added}</span>
                        )}
                        {diffStats.removed > 0 && (
                          <span className="code-git-file__diff-del">-{diffStats.removed}</span>
                        )}
                      </span>
                    )}
                  </div>
                  {isConfirming ? (
                    <div className="code-git-file__confirm">
                      <span className="code-git-file__confirm-text">放弃该文件的更改？</span>
                      <button
                        type="button"
                        className="code-git-link-btn code-git-link-btn--danger"
                        onClick={() => {
                          onDiscard?.(file.path);
                          setPendingDiscard(null);
                        }}
                        disabled={actionLoading}
                      >
                        确认放弃
                      </button>
                      <button
                        type="button"
                        className="code-git-link-btn"
                        onClick={() => setPendingDiscard(null)}
                        disabled={actionLoading}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
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
                      {onDiscard && (file.unstaged || file.untracked) && (
                        <button
                          type="button"
                          className="code-mini-icon-btn code-mini-icon-btn--danger"
                          onClick={() => setPendingDiscard(file.path)}
                          disabled={actionLoading}
                          title="放弃更改"
                          aria-label={`放弃 ${file.path} 的更改`}
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="code-git-panel__empty">
            <Check size={14} />
            <span>工作区干净</span>
          </div>
        )}
      </div>
    </div>
  );
}
