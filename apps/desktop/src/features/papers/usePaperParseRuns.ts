import { useEffect, useState } from "react";
import { apiClient } from "../../lib/client";
import { rowToPaperParseRun, type PaperParseRun } from "./shared";

export function usePaperParseRuns(paperId?: string) {
  const [parseRuns, setParseRuns] = useState<PaperParseRun[]>([]);
  const [parseRunsLoading, setParseRunsLoading] = useState(false);

  useEffect(() => {
    if (!paperId) {
      setParseRuns([]);
      return;
    }

    let cancelled = false;
    setParseRunsLoading(true);
    apiClient.papers
      .listParseRuns(paperId)
      .then((response) => {
        if (!cancelled) {
          setParseRuns(response.runs.map(rowToPaperParseRun));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParseRuns([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setParseRunsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paperId]);

  return { parseRuns, parseRunsLoading };
}
