import type { ResearchFieldBriefing, ResearchInterest } from "@research-copilot/types";

export interface FieldDynamicsActivityPoint {
  label: string;
  candidatePaperCount: number;
  selectedPaperCount: number;
  deadlineCount: number;
}

export function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "";
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(startDate)} ~ ${fmt(endDate)}`;
}

export function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function buildInterestOptions(interests: ResearchInterest[]): Array<{
  value: string;
  label: string;
}> {
  return [
    { value: "", label: "全部兴趣" },
    ...interests.map((interest) => ({
      value: interest.id,
      label: interest.folder_name?.trim() || interest.topic,
    })),
  ];
}

export function unreadBriefings(briefings: ResearchFieldBriefing[]): number {
  return briefings.filter((b) => !b.is_read).length;
}

export function buildActivityPoints(
  briefings: ResearchFieldBriefing[],
): FieldDynamicsActivityPoint[] {
  const byDay = new Map<string, FieldDynamicsActivityPoint>();
  for (const briefing of briefings) {
    const date = new Date(briefing.generated_at);
    if (Number.isNaN(date.getTime())) continue;
    const dayKey = date.toISOString().slice(0, 10);
    const label = dayKey.slice(5);
    const current = byDay.get(dayKey) ?? {
      label,
      candidatePaperCount: 0,
      selectedPaperCount: 0,
      deadlineCount: 0,
    };
    current.candidatePaperCount += briefing.stats.candidate_paper_count;
    current.selectedPaperCount += briefing.stats.selected_paper_count;
    current.deadlineCount += briefing.stats.upcoming_deadline_count;
    byDay.set(dayKey, current);
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([, point]) => point);
}

export function sumBriefingStats(briefings: ResearchFieldBriefing[]) {
  return briefings.reduce(
    (total, briefing) => ({
      candidatePaperCount: total.candidatePaperCount + briefing.stats.candidate_paper_count,
      selectedPaperCount: total.selectedPaperCount + briefing.stats.selected_paper_count,
      deadlineCount: total.deadlineCount + briefing.stats.upcoming_deadline_count,
      trendCount: total.trendCount + briefing.stats.trend_count,
    }),
    { candidatePaperCount: 0, selectedPaperCount: 0, deadlineCount: 0, trendCount: 0 },
  );
}
