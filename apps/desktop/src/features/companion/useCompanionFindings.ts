import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage, type ActiveResearcherFinding } from "../../lib/client";

interface UseCompanionFindingsOptions {
  onMarkAllRead: () => void;
  onFindingImported?: (findingId: string) => void;
}

export function useCompanionFindings({
  onMarkAllRead,
  onFindingImported,
}: UseCompanionFindingsOptions) {
  const [findings, setFindings] = useState<ActiveResearcherFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    apiClient.activeResearcher
      .findings(50)
      .then((result) => {
        if (cancelled) return;
        setFindings(result.findings.filter((finding) => !finding.is_read));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = async () => {
    try {
      await apiClient.activeResearcher.markRead();
      setFindings([]);
      onMarkAllRead();
    } catch (error) {
      console.warn("Failed to mark findings read:", error);
    }
  };

  const importFinding = async (finding: ActiveResearcherFinding) => {
    setImportingId(finding.id);
    setImportErrors((current) => {
      if (!current[finding.id]) return current;
      const next = { ...current };
      delete next[finding.id];
      return next;
    });

    try {
      const result = await apiClient.activeResearcher.importFinding(finding.id);
      setFindings((current) => current.filter((item) => item.id !== finding.id));
      setNotice(`已导入《${result.title || finding.title}》`);
      onFindingImported?.(finding.id);
    } catch (error) {
      setImportErrors((current) => ({
        ...current,
        [finding.id]: formatErrorMessage(error),
      }));
    } finally {
      setImportingId((current) => (current === finding.id ? null : current));
    }
  };

  return {
    findings,
    loading,
    importingId,
    importErrors,
    notice,
    setNotice,
    markAllRead,
    importFinding,
  };
}
