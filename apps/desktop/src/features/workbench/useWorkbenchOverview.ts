import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage, submissionApi } from "../../lib/client";
import {
  type SubmissionOverviewStats,
  type WorkbenchOverviewModel,
  type WorkbenchOverviewSource,
} from "./shared";
import { buildSourceSummary, buildWorkbenchOverviewModel } from "./model";

interface WorkbenchOverviewState {
  model: WorkbenchOverviewModel | null;
  loading: boolean;
  error: string;
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
      .then(async ([papers, interests, notes, sessions, submission]) => {
        if (cancelled) return;

        const source: WorkbenchOverviewSource = {
          papers,
          interests,
          notes,
          sessions,
          submission,
        };

        const model = buildWorkbenchOverviewModel(source);

        // Try AI-generated overview text; fall back to static text silently
        try {
          const summary = buildSourceSummary(source);
          const aiText = await apiClient.workbench.generateOverviewText(
            JSON.stringify(summary),
          );
          if (!cancelled) {
            if (aiText.heroTitle) {
              model.heroTitle = aiText.heroTitle;
            }
            if (aiText.heroDescription) {
              model.heroDescription = aiText.heroDescription;
            }
            if (aiText.summaryItems?.length === 3) {
              model.summaryItems = aiText.summaryItems;
            }
            model.aiGenerated = true;
          }
        } catch {
          // AI unavailable — keep static text from buildWorkbenchOverviewModel
        }

        if (cancelled) return;
        setState({ model, loading: false, error: "" });
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
