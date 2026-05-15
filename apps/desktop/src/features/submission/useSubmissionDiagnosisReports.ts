import { useCallback, useEffect, useState } from "react";
import { submissionApi } from "../../lib/client";
import {
  rowToDiagnosisReport,
  type SubmissionDiagnosisReport,
} from "./shared";

interface UseSubmissionDiagnosisReportsOptions {
  onError?: (error: unknown) => void;
  onImported?: (created: number) => void | Promise<void>;
}

export function useSubmissionDiagnosisReports(
  submissionId: string,
  { onError, onImported }: UseSubmissionDiagnosisReportsOptions = {},
) {
  const [reports, setReports] = useState<SubmissionDiagnosisReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingReportId, setImportingReportId] = useState<string | null>(null);

  const refreshReports = useCallback(() => {
    if (!submissionId) {
      setReports([]);
      return Promise.resolve();
    }

    setLoading(true);
    return submissionApi
      .listDiagnosisReports(submissionId)
      .then((response) => {
        setReports(response.reports.map(rowToDiagnosisReport));
      })
      .catch((error) => {
        onError?.(error);
        setReports([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [onError, submissionId]);

  useEffect(() => {
    void refreshReports();
  }, [refreshReports]);

  const importReportToChecklist = useCallback(
    async (reportId: string) => {
      setImportingReportId(reportId);
      try {
        const response = await submissionApi.importDiagnosisReportToChecklist(reportId);
        await onImported?.(response.created);
      } catch (error) {
        onError?.(error);
      } finally {
        setImportingReportId(null);
      }
    },
    [onError, onImported],
  );

  return {
    reports,
    loading,
    importingReportId,
    refreshReports,
    importReportToChecklist,
  };
}
