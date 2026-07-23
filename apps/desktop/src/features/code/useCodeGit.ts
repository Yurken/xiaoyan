import { useCallback, useEffect, useState } from "react";
import {
  codeApi,
  formatErrorMessage,
  type CodeGitSnapshot,
  type CodeReviewReport,
} from "../../lib/client";

export function useCodeGit(workingDir: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<CodeGitSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<CodeReviewReport | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [switchingBranch, setSwitchingBranch] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!workingDir) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await codeApi.gitSnapshot(workingDir);
      setSnapshot(next);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function withAction(action: () => Promise<void>) {
    if (!workingDir) return;
    setActionLoading(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function stage(path: string) {
    await withAction(() => codeApi.gitStagePath(workingDir ?? "", path));
  }

  async function unstage(path: string) {
    await withAction(() => codeApi.gitUnstagePath(workingDir ?? "", path));
  }

  async function discard(path: string) {
    await withAction(() => codeApi.gitDiscardPath(workingDir ?? "", path));
  }

  async function stageAll(paths: string[]) {
    if (!workingDir || paths.length === 0) return;
    setActionLoading(true);
    setError("");
    try {
      for (const path of paths) {
        await codeApi.gitStagePath(workingDir, path);
      }
      await refresh();
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function unstageAll(paths: string[]) {
    if (!workingDir || paths.length === 0) return;
    setActionLoading(true);
    setError("");
    try {
      for (const path of paths) {
        await codeApi.gitUnstagePath(workingDir, path);
      }
      await refresh();
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function openFile(path: string) {
    if (!workingDir) return;
    setError("");
    try {
      // workingDir 是规范化后的绝对路径，path 是相对路径，拼接成绝对路径交给后端 opener。
      const absolute = workingDir.replace(/[\\/]+$/, "") + "/" + path;
      await codeApi.openFile(absolute);
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }

  async function commit() {
    const message = commitMessage.trim();
    if (!message) {
      setError("请输入提交信息。");
      return;
    }
    await withAction(async () => {
      await codeApi.gitCommit(workingDir ?? "", message);
      setCommitMessage("");
    });
  }

  async function generateCommitMessage() {
    if (!workingDir) return;
    setGeneratingMessage(true);
    setError("");
    try {
      const message = await codeApi.generateCommitMessage(workingDir);
      setCommitMessage(message);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setGeneratingMessage(false);
    }
  }

  async function loadBranches() {
    if (!workingDir) {
      setBranches([]);
      return;
    }
    try {
      const list = await codeApi.gitListBranches(workingDir);
      setBranches(list);
    } catch {
      setBranches([]);
    }
  }

  async function checkoutBranch(branch: string) {
    if (!workingDir || !branch) return;
    setSwitchingBranch(true);
    setError("");
    try {
      await codeApi.gitCheckoutBranch(workingDir, branch);
      await refresh();
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setSwitchingBranch(false);
    }
  }

  async function runReview() {
    if (!workingDir) return;
    setReviewing(true);
    setError("");
    try {
      const report = await codeApi.reviewChanges(workingDir);
      setReview(report);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  }

  return {
    snapshot,
    loading,
    actionLoading,
    reviewing,
    review,
    commitMessage,
    setCommitMessage,
    generatingMessage,
    error,
    setError,
    refresh,
    stage,
    unstage,
    discard,
    stageAll,
    unstageAll,
    openFile,
    commit,
    generateCommitMessage,
    branches,
    loadBranches,
    checkoutBranch,
    switchingBranch,
    runReview,
  };
}
