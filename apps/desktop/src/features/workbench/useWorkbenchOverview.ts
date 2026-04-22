import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage, submissionApi } from "../../lib/client";
import {
  type SubmissionOverviewStats,
  type WorkbenchOverviewModel,
  type WorkbenchOverviewSource,
} from "./shared";
import { buildWorkbenchOverviewModel } from "./model";

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
      .then(([papers, interests, notes, sessions, submission]) => {
        if (cancelled) return;

        const source: WorkbenchOverviewSource = {
          papers,
          interests,
          notes,
          sessions,
          submission,
        };

        setState({
          model: buildWorkbenchOverviewModel(source),
          loading: false,
          error: "",
        });
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
