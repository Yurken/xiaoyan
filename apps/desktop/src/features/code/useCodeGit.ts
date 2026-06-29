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
    error,
    setError,
    refresh,
    stage,
    unstage,
    commit,
    runReview,
  };
}
