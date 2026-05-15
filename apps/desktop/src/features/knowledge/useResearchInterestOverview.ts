import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage, submissionApi, type MemoryCheckpoint } from "../../lib/client";
import type {
  KnowledgeGraphClaim,
  KnowledgeGraphExperiment,
} from "./shared";

export interface ResearchOverviewSubmission {
  id: string;
  title: string;
  venueName: string;
  status: string;
  deadline: string | null;
  updatedAt: string;
}

export interface ResearchOverviewCheckpoint {
  id: string;
  goal: string;
  summary: string;
  nextSteps: string[];
  openQuestions: string[];
  status: string;
  updatedAt: string;
}

interface ResearchInterestOverviewState {
  loading: boolean;
  error: string;
  claims: KnowledgeGraphClaim[];
  experiments: KnowledgeGraphExperiment[];
  submissions: ResearchOverviewSubmission[];
  checkpoints: ResearchOverviewCheckpoint[];
}

const EMPTY_STATE: ResearchInterestOverviewState = {
  loading: true,
  error: "",
  claims: [],
  experiments: [],
  submissions: [],
  checkpoints: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function mapSubmission(row: unknown): ResearchOverviewSubmission | null {
  if (!isRecord(row)) return null;
  const id = stringValue(row.id);
  if (!id) return null;
  return {
    id,
    title: stringValue(row.title, "未命名投稿"),
    venueName: stringValue(row.venueName),
    status: stringValue(row.status, "writing"),
    deadline: nullableString(row.deadline),
    updatedAt: stringValue(row.updatedAt),
  };
}

function mapCheckpoint(row: MemoryCheckpoint): ResearchOverviewCheckpoint {
  return {
    id: row.id,
    goal: row.goal,
    summary: row.summary,
    nextSteps: row.next_steps,
    openQuestions: row.open_questions,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export function useResearchInterestOverview(interestId: string): ResearchInterestOverviewState {
  const [state, setState] = useState<ResearchInterestOverviewState>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;
    setState(EMPTY_STATE);

    Promise.all([
      apiClient.knowledge.graph.snapshot(),
      apiClient.memory.listCheckpoints(20).catch(() => ({ checkpoints: [] })),
      submissionApi.list().catch(() => ({ submissions: [] })),
    ])
      .then(([snapshot, checkpointResult, submissionResult]) => {
        if (cancelled) return;

        const claims = snapshot.claims.filter((claim) => claim.researchInterestId === interestId);
        const claimIds = new Set(claims.map((claim) => claim.id));
        const evidenceLinks = snapshot.evidenceLinks.filter((link) => claimIds.has(link.claimId));
        const experimentIds = new Set(
          evidenceLinks
            .filter((link) => link.sourceKind === "experiment")
            .map((link) => link.sourceId),
        );
        const experiments = snapshot.experiments.filter((experiment) => experimentIds.has(experiment.id));
        const linkedSubmissionIds = new Set(
          experiments
            .map((experiment) => experiment.linkedSubmissionId)
            .filter((id): id is string => Boolean(id)),
        );
        const submissions = submissionResult.submissions
          .map(mapSubmission)
          .filter((item): item is ResearchOverviewSubmission => Boolean(item))
          .filter((item) => linkedSubmissionIds.has(item.id));
        const checkpoints = checkpointResult.checkpoints
          .filter((checkpoint) => checkpoint.context_type === "interest" && checkpoint.context_id === interestId)
          .map(mapCheckpoint);

        setState({
          loading: false,
          error: "",
          claims,
          experiments,
          submissions,
          checkpoints,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          ...EMPTY_STATE,
          loading: false,
          error: formatErrorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [interestId]);

  return state;
}
