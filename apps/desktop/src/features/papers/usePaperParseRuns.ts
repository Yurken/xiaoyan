import { useEffect, useState } from "react";
import { safeListen } from "../../lib/tauriEvent";
import { apiClient } from "../../lib/client";
import { rowToPaperParseRun, type PaperParseRun } from "./shared";

export function usePaperParseRuns(paperId?: string) {
  const [parseRuns, setParseRuns] = useState<PaperParseRun[]>([]);
  const [parseRunsLoading, setParseRunsLoading] = useState(false);
  const [reparseLoading, setReparseLoading] = useState(false);
  const [reparseError, setReparseError] = useState("");

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

  useEffect(() => {
    if (!paperId) {
      return undefined;
    }

    let unlisten: (() => void) | undefined;
    let mounted = true;
    void safeListen<{ paper_id: string; status: string }>("paper:status", (event) => {
      if (event.payload.paper_id !== paperId) {
        return;
      }

      if (event.payload.status === "parsed" || event.payload.status === "failed") {
        void apiClient.papers.listParseRuns(paperId).then((response) => {
          setParseRuns(response.runs.map(rowToPaperParseRun));
        });
      }
    }).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      mounted = false;
      unlisten?.();
      unlisten = undefined;
    };
  }, [paperId]);

  const reparsePaper = async () => {
    if (!paperId) {
      return;
    }

    setReparseLoading(true);
    setReparseError("");
    try {
      await apiClient.papers.reparse(paperId);
    } catch (error) {
      setReparseError(error instanceof Error ? error.message : String(error));
    } finally {
      setReparseLoading(false);
    }
  };

  return { parseRuns, parseRunsLoading, reparseLoading, reparseError, reparsePaper };
}
