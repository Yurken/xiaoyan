import { useMemo } from "react";
import { POPULAR_VENUES } from "../../data/venues";
import type {
  CcfRating,
  RejectionRecoveryPlan,
  RejectionRecoveryTarget,
  Submission,
} from "./shared";

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[\s,，、;；。.!?？：:()（）[\]{}"'“”‘’/\\|-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function venuePrestige(ccf: CcfRating, sci?: boolean, sciQuartile?: string): number {
  if (ccf === "A") return 5;
  if (ccf === "B") return 4;
  if (ccf === "C") return 3;
  if (sciQuartile === "Q1") return 4;
  if (sciQuartile === "Q2") return 3;
  if (sci) return 2;
  return 1;
}

function buildTargets(submission: Submission): RejectionRecoveryTarget[] {
  const sourceTerms = tokenize(`${submission.title} ${submission.venue}`);
  const sourcePrestige = POPULAR_VENUES.find((venue) => venue.name === submission.venue)?.ccf ?? "none";
  const sourceScore = venuePrestige(sourcePrestige);

  return POPULAR_VENUES
    .filter((venue) => venue.name !== submission.venue)
    .map((venue) => {
      const haystack = `${venue.name} ${venue.fullName} ${venue.area}`.toLowerCase();
      const overlap = sourceTerms.filter((term) => haystack.includes(term)).length;
      const typeFit = venue.type === submission.venueType ? 4 : 1;
      const prestigeScore = venuePrestige(venue.ccf, venue.sci, venue.sciQuartile);
      const downshiftFit = prestigeScore <= Math.max(2, sourceScore) ? 5 : 0;
      const score = overlap * 6 + typeFit + downshiftFit + prestigeScore;
      const reason =
        prestigeScore < sourceScore
          ? "档位更稳妥，适合作为拒稿后的降风险备选。"
          : venue.type === submission.venueType
            ? "类型一致，转投材料改动成本较低。"
            : "可作为跨类型备选，适合重新包装贡献边界。";

      return {
        id: venue.id,
        name: venue.name,
        fullName: venue.fullName,
        type: venue.type,
        area: venue.area,
        ccf: venue.ccf,
        sci: venue.sci,
        sciQuartile: venue.sciQuartile,
        reason,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ score: _score, ...target }) => target);
}

function buildPlan(submission: Submission): RejectionRecoveryPlan {
  return {
    submission,
    summary: "先把拒稿意见转成修改任务，再选择更稳妥的目标刊会进入下一轮投稿。",
    actions: [
      "归纳拒稿意见中的高频问题，区分必须补实验、必须改写和可解释回应。",
      "基于最后一个版本保存转投修改版，记录本轮修改目标。",
      "重写 Cover Letter，主动说明本轮修改和目标刊会适配点。",
    ],
    targets: buildTargets(submission),
  };
}

export function useRejectionRecovery(submissions: Submission[]) {
  return useMemo(
    () => submissions.filter((submission) => submission.status === "rejected").map(buildPlan),
    [submissions]
  );
}
