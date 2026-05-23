import type { WorkbenchOverviewSource } from "./shared";

export function buildSourceSummary(source: WorkbenchOverviewSource): Record<string, unknown> {
  const analyzedCount = source.papers.filter((p) => Boolean(p.analysis)).length;
  const processingCount = source.papers.filter(
    (p) => p.status === "parsing" || p.status === "analyzing",
  ).length;
  const failedCount = source.papers.filter(
    (p) => p.status === "failed" || p.status === "error",
  ).length;

  return {
    interests: source.interests.map((i) => ({
      name: i.folder_name || i.topic,
      status: i.status,
    })),
    papers_total: source.papers.length,
    papers_analyzed: analyzedCount,
    papers_processing: processingCount,
    papers_failed: failedCount,
    notes_total: source.notes.length,
    sessions_total: source.sessions.length,
    memory_checkpoints: source.checkpoints.slice(0, 5).map((checkpoint) => ({
      goal: checkpoint.goal,
      status: checkpoint.status,
      context_type: checkpoint.contextType,
      next_steps: checkpoint.nextSteps.slice(0, 2),
      open_questions: checkpoint.openQuestions.slice(0, 2),
      updated_at: checkpoint.updatedAt,
    })),
    submission: {
      pending_reviews: source.submission.pendingReviews,
      active_count: source.submission.active,
      upcoming_ddls: source.submission.upcomingDdls.map((d) => ({
        name: d.name,
        deadline: d.deadline,
      })),
    },
  };
}
