import { useEffect, useState } from "react";
import { safeListen } from "../../lib/tauriEvent";
import { apiClient, formatErrorMessage, submissionApi } from "../../lib/client";
import {
  type SubmissionOverviewStats,
  type WorkbenchOverviewModel,
  type WorkbenchOverviewSource,
  type WorkbenchOverviewText,
  rowToWorkbenchCheckpoint,
} from "./shared";
import { buildWorkbenchOverviewModel } from "./model";
import { buildSourceSummary } from "./sourceSummary";

interface WorkbenchOverviewState {
  model: WorkbenchOverviewModel | null;
  loading: boolean;
  error: string;
}

function applyGeneratedText(
  model: WorkbenchOverviewModel,
  text: Partial<WorkbenchOverviewText>,
): WorkbenchOverviewModel {
  let changed = false;
  const next: WorkbenchOverviewModel = { ...model };
  const heroTitle = text.heroTitle?.trim();
  const heroDescription = text.heroDescription?.trim();
  const summaryItems = text.summaryItems
    ?.map((item) => ({
      title: item.title.trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.title && item.description);

  if (heroTitle) {
    next.heroTitle = heroTitle;
    changed = true;
  }
  if (heroDescription) {
    next.heroDescription = heroDescription;
    changed = true;
  }
  if (summaryItems?.length === 3) {
    next.summaryItems = summaryItems;
    changed = true;
  }

  return changed ? { ...next, aiGenerated: true } : model;
}

export function useWorkbenchOverview(): WorkbenchOverviewState {
  const [state, setState] = useState<WorkbenchOverviewState>({
    model: null,
    loading: true,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;

    const loadOverview = () => {
      Promise.all([
        apiClient.papers.list(0, 100),
        apiClient.knowledge.listInterests(),
        apiClient.knowledge.listNotes(),
        apiClient.chat.listSessions(),
        apiClient.memory.listCheckpoints(8).catch(() => ({ checkpoints: [] })),
        submissionApi.stats().catch<SubmissionOverviewStats>(() => ({
          active: 0,
          pendingReviews: 0,
          upcomingDdls: [],
        })),
        apiClient.workbench.getOverviewTextCache().catch(() => null),
      ])
        .then(([papers, interests, notes, sessions, checkpointResult, submission, cachedText]) => {
          if (cancelled) return;

          const source: WorkbenchOverviewSource = {
            papers,
            interests,
            notes,
            sessions,
            checkpoints: checkpointResult.checkpoints.map(rowToWorkbenchCheckpoint),
            submission,
          };

          const baseModel = buildWorkbenchOverviewModel(source);
          const model = cachedText ? applyGeneratedText(baseModel, cachedText) : baseModel;
          setState({ model, loading: false, error: "" });

          const summary = buildSourceSummary(source);
          void apiClient.workbench
            .generateOverviewText(JSON.stringify(summary))
            .then((aiText) => {
              if (cancelled) return;
              setState((current) => {
                if (!current.model) return current;
                return {
                  ...current,
                  model: applyGeneratedText(current.model, aiText),
                };
              });
            })
            .catch((err) => { console.warn("Failed to apply AI suggestion:", err); });
        })
        .catch((error) => {
          if (cancelled) return;
          setState({
            model: null,
            loading: false,
            error: formatErrorMessage(error),
          });
        });
    };

    loadOverview();
    let unlistenPlan: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;
    let mounted = true;

    void safeListen("interest:plan", loadOverview).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlistenPlan = cleanup;
    });
    void safeListen("interest:status", loadOverview).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlistenStatus = cleanup;
    });

    return () => {
      cancelled = true;
      mounted = false;
      unlistenPlan?.();
      unlistenStatus?.();
      unlistenPlan = undefined;
      unlistenStatus = undefined;
    };
  }, []);

  return state;
}
