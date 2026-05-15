import { hasActionableCheckpoint } from "./checkpointOverview";
import type { WorkbenchOverviewSource, WorkbenchSectionLayout } from "./shared";

export function buildLayout(
  source: WorkbenchOverviewSource,
  hasInterests: boolean,
): WorkbenchSectionLayout[] {
  const hasUrgentRisks =
    source.submission.pendingReviews > 0 ||
    source.submission.upcomingDdls.length > 0;
  const hasHandoffs =
    source.papers.some((p) => Boolean(p.analysis)) ||
    source.notes.length > 0 ||
    source.sessions.length > 0 ||
    source.checkpoints.length > 0;
  const hasAgenda = hasUrgentRisks || hasInterests || hasActionableCheckpoint(source.checkpoints);
  const hasAssets =
    hasInterests || source.notes.length > 0 || source.papers.length > 0;

  const sections: WorkbenchSectionLayout[] = [];

  if (hasAgenda) {
    sections.push({
      type: "agenda",
      priority: hasUrgentRisks ? 0 : 10,
      prominence: hasUrgentRisks ? "promoted" : "normal",
    });
  }

  if (hasUrgentRisks) {
    sections.push({
      type: "risks",
      priority: 5,
      prominence: "promoted",
    });
  } else if (
    source.papers.some(
      (p) => p.status === "failed" || p.status === "error" || p.status === "parsing" || p.status === "analyzing",
    )
  ) {
    sections.push({ type: "risks", priority: 50, prominence: "normal" });
  }

  if (hasHandoffs) {
    sections.push({
      type: "handoffs",
      priority: hasUrgentRisks ? 15 : 20,
      prominence: "normal",
    });
  }

  if (hasInterests) {
    sections.push({
      type: "interests",
      priority: 30,
      prominence: "normal",
    });
  }

  if (hasAssets) {
    sections.push({
      type: "assets",
      priority: 40,
      prominence: "normal",
    });
  }

  sections.sort((a, b) => a.priority - b.priority);
  return sections;
}
