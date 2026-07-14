import { useCallback, useEffect, useRef, useState } from "react";
import type { ExperimentCodeSession, ExperimentSnapshot } from "@research-copilot/types";
import { codeApi, experimentApi, formatErrorMessage, type CodeGitSnapshot } from "../../lib/client";

interface UseExperimentSnapshotsOptions {
  experimentId: string;
  activeSession: ExperimentCodeSession | null;
  workingDir: string | null;
  onError: (message: string) => void;
  onRestored?: () => void | Promise<void>;
}

function buildCodeState(workingDir: string, git: CodeGitSnapshot): Record<string, unknown> {
  return {
    workingDirectory: workingDir,
    git: {
      isRepo: git.is_repo,
      branch: git.branch,
      head: git.head,
      upstream: git.upstream,
      ahead: git.ahead,
      behind: git.behind,
      files: git.files,
      stagedDiff: git.staged_diff,
      unstagedDiff: git.unstaged_diff,
      recentCommits: git.recent_commits,
    },
  };
}

export function useExperimentSnapshots({
  experimentId,
  activeSession,
  workingDir,
  onError,
  onRestored,
}: UseExperimentSnapshotsOptions) {
  const [snapshots, setSnapshots] = useState<ExperimentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const loadSequenceRef = useRef(0);

  const loadSnapshots = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await experimentApi.snapshots.list(experimentId);
      if (sequence === loadSequenceRef.current) {
        setSnapshots(result.snapshots ?? []);
      }
    } catch (error) {
      if (sequence === loadSequenceRef.current) {
        setLoadError(formatErrorMessage(error));
      }
    } finally {
      if (sequence === loadSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [experimentId]);

  useEffect(() => {
    void loadSnapshots();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [loadSnapshots]);

  async function createSnapshot(title: string): Promise<boolean> {
    if (creating) return false;
    setCreating(true);
    try {
      const resolvedWorkingDir = workingDir ?? activeSession?.working_dir ?? undefined;
      let envSnapshot: Record<string, unknown> = {};

      if (resolvedWorkingDir) {
        try {
          const git = await codeApi.gitSnapshot(resolvedWorkingDir);
          envSnapshot = buildCodeState(resolvedWorkingDir, git);
        } catch (error) {
          // A missing/non-Git workspace must not prevent the experiment record itself
          // from being snapshotted. Preserve the capture failure for later diagnosis.
          envSnapshot = {
            workingDirectory: resolvedWorkingDir,
            captureWarning: formatErrorMessage(error),
          };
        }
      }

      const snapshot = await experimentApi.snapshots.create(experimentId, {
        title: title.trim(),
        codeSessionId: activeSession?.id,
        toolId: activeSession?.tool_id ?? undefined,
        model: activeSession?.model ?? undefined,
        workingDir: resolvedWorkingDir,
        envSnapshot,
      });
      setSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)]);
      setLoadError("");
      return true;
    } catch (error) {
      onError(formatErrorMessage(error));
      return false;
    } finally {
      setCreating(false);
    }
  }

  async function deleteSnapshots(ids: string[]): Promise<string[]> {
    if (deleting || ids.length === 0) return [];
    setDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => experimentApi.snapshots.delete(id)));
      const deletedIds = ids.filter((_, index) => results[index]?.status === "fulfilled");
      const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
      if (deletedIds.length > 0) {
        const deleted = new Set(deletedIds);
        setSnapshots((current) => current.filter((snapshot) => !deleted.has(snapshot.id)));
      }
      if (failedIds.length > 0) {
        onError(`${failedIds.length} 个快照删除失败，请重试`);
      }
      return failedIds;
    } finally {
      setDeleting(false);
    }
  }

  async function renameSnapshot(id: string, title: string): Promise<boolean> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || renamingId) return false;
    setRenamingId(id);
    try {
      await experimentApi.snapshots.rename(id, normalizedTitle);
      setSnapshots((current) => current.map((snapshot) => (
        snapshot.id === id ? { ...snapshot, title: normalizedTitle } : snapshot
      )));
      return true;
    } catch (error) {
      onError(formatErrorMessage(error));
      return false;
    } finally {
      setRenamingId(null);
    }
  }

  async function restoreSnapshot(id: string): Promise<boolean> {
    if (restoring) return false;
    setRestoring(true);
    try {
      await experimentApi.snapshots.restore(id);
      await Promise.resolve(onRestored?.());
      await loadSnapshots();
      return true;
    } catch (error) {
      onError(formatErrorMessage(error));
      return false;
    } finally {
      setRestoring(false);
    }
  }

  return {
    snapshots,
    loading,
    loadError,
    creating,
    deleting,
    renamingId,
    restoring,
    reload: loadSnapshots,
    createSnapshot,
    deleteSnapshots,
    renameSnapshot,
    restoreSnapshot,
  };
}
