import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage, submissionApi } from "../../lib/client";
import {
  type SubmissionOverviewStats,
  type WorkbenchOverviewModel,
  type WorkbenchOverviewSource,
  type WorkbenchOverviewText,
} from "./shared";
import { buildSourceSummary, buildWorkbenchOverviewModel } from "./model";

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

    Promise.all([
      apiClient.papers.list(0, 100),
      apiClient.knowledge.listInterests(),
      apiClient.knowledge.listNotes(),
      apiClient.chat.listSessions(),
      submissionApi.stats().catch<SubmissionOverviewStats>(() => ({
        active: 0,
        pendingReviews: 0,
        upcomingDdls: [],
      })),
    ])
      .then(([papers, interests, notes, sessions, submission]) => {
        if (cancelled) return;

        const source: WorkbenchOverviewSource = {
          papers,
          interests,
          notes,
          sessions,
          submission,
        };

        const model = buildWorkbenchOverviewModel(source);
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
          .catch(() => {});
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          model: null,
          loading: false,
          error: formatErrorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
