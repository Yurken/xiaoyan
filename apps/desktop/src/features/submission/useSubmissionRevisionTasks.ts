import { useCallback, useEffect, useState } from "react";
import { experimentApi, submissionApi } from "../../lib/client";
import {
  rowToSubmissionExperimentOption,
  rowToRevisionTask,
  rowToVersion,
  type PaperVersion,
  type RevisionTaskStatus,
  type SubmissionExperimentOption,
  type SubmissionRevisionTask,
} from "./shared";

interface UseSubmissionRevisionTasksOptions {
  onError?: (error: unknown) => void;
  onImported?: (created: number) => void;
}

export function useSubmissionRevisionTasks(
  submissionId: string,
  { onError, onImported }: UseSubmissionRevisionTasksOptions = {},
) {
  const [tasks, setTasks] = useState<SubmissionRevisionTask[]>([]);
  const [versions, setVersions] = useState<PaperVersion[]>([]);
  const [experiments, setExperiments] = useState<SubmissionExperimentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingReportId, setImportingReportId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const refreshTasks = useCallback(() => {
    if (!submissionId) {
      setTasks([]);
      setVersions([]);
      setExperiments([]);
      return Promise.resolve();
    }

    setLoading(true);
    return Promise.all([
      submissionApi.listRevisionTasks(submissionId),
      submissionApi.listVersions(submissionId),
      experimentApi.list(),
    ])
      .then(([taskResponse, versionResponse, experimentResponse]) => {
        setTasks(taskResponse.tasks.map(rowToRevisionTask));
        setVersions(versionResponse.versions.map(rowToVersion));
        setExperiments(
          experimentResponse.experiments
            .map(rowToSubmissionExperimentOption)
            .filter((experiment) => !experiment.linkedSubmissionId || experiment.linkedSubmissionId === submissionId)
        );
      })
      .catch((error) => {
        onError?.(error);
        setTasks([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [onError, submissionId]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const importReportToTasks = useCallback(
    async (reportId: string) => {
      setImportingReportId(reportId);
      try {
        const response = await submissionApi.importDiagnosisReportToTasks(reportId);
        await refreshTasks();
        onImported?.(response.created);
      } catch (error) {
        onError?.(error);
      } finally {
        setImportingReportId(null);
      }
    },
    [onError, onImported, refreshTasks],
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      patch: Partial<{ status: RevisionTaskStatus; paperVersionId: string; experimentId: string }>,
    ) => {
      setUpdatingTaskId(taskId);
      try {
        await submissionApi.updateRevisionTask(taskId, patch);
        await refreshTasks();
      } catch (error) {
        onError?.(error);
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [onError, refreshTasks],
  );

  return {
    tasks,
    versions,
    experiments,
    loading,
    importingReportId,
    updatingTaskId,
    refreshTasks,
    importReportToTasks,
    updateTask,
  };
}
