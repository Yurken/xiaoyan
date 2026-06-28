import type { ResearchFieldBriefing, ResearchInterest } from "@research-copilot/types";

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
