import type { ResearchFieldBriefing } from "@research-copilot/types";
import { describe, expect, it } from "vitest";
import { buildActivityPoints, sumBriefingStats } from "../../../features/field-dynamics/shared";

function briefing(
  generatedAt: string,
  candidatePaperCount: number,
  selectedPaperCount = 2,
  deadlineCount = 1,
): ResearchFieldBriefing {
  return {
    id: generatedAt,
    interest_id: "interest-1",
    interest_topic: "机器学习",
    period_start: generatedAt,
    period_end: generatedAt,
    summary: "摘要",
    trends: [],
    key_papers: [],
    upcoming_deadlines: [],
    generated_at: generatedAt,
    is_read: false,
    stats: {
      candidate_paper_count: candidatePaperCount,
      selected_paper_count: selectedPaperCount,
      upcoming_deadline_count: deadlineCount,
      trend_count: 3,
    },
  };
}

describe("field-dynamics/shared", () => {
  it("按日期聚合历史快照，并按时间正序输出", () => {
    const points = buildActivityPoints([
      briefing("2026-07-12T09:00:00.000Z", 3),
      briefing("2026-07-10T09:00:00.000Z", 4),
      briefing("2026-07-12T14:00:00.000Z", 5, 1, 2),
    ]);

    expect(points).toEqual([
      { label: "07-10", candidatePaperCount: 4, selectedPaperCount: 2, deadlineCount: 1 },
      { label: "07-12", candidatePaperCount: 8, selectedPaperCount: 3, deadlineCount: 3 },
    ]);
  });

  it("汇总最新简报的统计快照", () => {
    expect(sumBriefingStats([briefing("2026-07-10T09:00:00.000Z", 4), briefing("2026-07-12T09:00:00.000Z", 3, 1, 0)])).toEqual({
      candidatePaperCount: 7,
      selectedPaperCount: 3,
      deadlineCount: 1,
      trendCount: 6,
    });
  });
});
