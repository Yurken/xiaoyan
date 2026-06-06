import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

export interface DiagnosisTask {
  id: string;
  risk: string;
  suggestion: string;
  isTaskCreated: boolean;
}

export function useSubmissionDiagnosisTasks(submissionId: string) {
  const [tasks, setTasks] = useState<DiagnosisTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTasks = () => {
    if (!submissionId) return;
    setLoading(true);
    apiClient.submissionDiagnosis
      .getDiagnosisTasks(submissionId)
      .then((data) => {
        setTasks(data);
        setLoading(false);
        setError("");
      })
      .catch((err) => {
        setTasks([]);
        setLoading(false);
        setError(formatErrorMessage(err));
      });
  };

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const createTask = async (diagnosisId: string) => {
    try {
      await apiClient.submissionDiagnosis.createTaskFromDiagnosis(diagnosisId);
      // Reload or optimistic update
      loadTasks();
    } catch (err) {
      console.error("Failed to create task", err);
    }
  };

  return { tasks, loading, error, createTask, loadTasks };
}
