import { useState } from "react";
import { POPULAR_VENUES } from "../../data/venues";
import type {
  CcfRating,
  Conference,
  Journal,
  RecommendationRiskLevel,
  RecommendationRiskPreference,
  RecommendationTier,
  VenueRecommendation,
  VenueRecommendationInput,
} from "./shared";

const INITIAL_RECOMMENDATION_INPUT: VenueRecommendationInput = {
  title: "",
  abstract: "",
  keywords: "natural language processing, machine learning, graph neural network",
  direction: "",
  targetType: "all",
  targetRank: "any",
  customRank: "",
  riskPreference: "balanced",
  timePreference: "any",
  extra: "",
};

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[\s,，、;；。.!?？：:()（）[\]{}"'“”‘’/\\|-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function deterministicJitter(seed: string): number {
  return seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
}

function getPrestigeScore(ccf: CcfRating, sci?: boolean, sciQuartile?: string): number {
  if (ccf === "A") return 36;
  if (ccf === "B") return 24;
  if (ccf === "C") return 12;
  if (sciQuartile === "Q1") return 30;
  if (sciQuartile === "Q2") return 22;
  if (sci) return 16;
  return 6;
}

function getRankFit(input: VenueRecommendationInput, venue: (typeof POPULAR_VENUES)[number]): number {
  if (input.targetRank === "any") return 8;
  if (input.targetRank === "custom") {
    const customRank = input.customRank.trim().toLowerCase();
    if (!customRank) return 4;
    return `${venue.name} ${venue.fullName} ${venue.ccf} ${venue.sciQuartile ?? ""} ${venue.area}`
      .toLowerCase()
      .includes(customRank)
      ? 14
      : -4;
  }
  if (input.targetRank === "ccf-a") return venue.ccf === "A" ? 16 : -6;
  if (input.targetRank === "ccf-b") return venue.ccf === "B" ? 16 : venue.ccf === "A" ? 6 : -3;
  if (input.targetRank === "ccf-c") return venue.ccf === "C" ? 16 : venue.ccf === "B" ? 6 : -2;
  if (input.targetRank === "sci-q1") return venue.sciQuartile === "Q1" ? 16 : venue.sci ? 4 : -6;
  if (input.targetRank === "sci-q2") return venue.sciQuartile === "Q2" ? 16 : venue.sciQuartile === "Q1" ? 7 : -4;
  return venue.sci ? 14 : -4;
}

function getRiskFit(riskPreference: RecommendationRiskPreference, prestigeScore: number): number {
  if (riskPreference === "stretch") return prestigeScore >= 30 ? 10 : 2;
  if (riskPreference === "safe") return prestigeScore <= 24 ? 10 : -4;
  return prestigeScore >= 18 && prestigeScore <= 32 ? 8 : 3;
}

function classifyTier(score: number, riskPreference: RecommendationRiskPreference, prestigeScore: number): RecommendationTier {
  if (riskPreference === "stretch" && prestigeScore >= 30) return "stretch";
  if (riskPreference === "safe" && prestigeScore <= 18) return "backup";
  if (score >= 76 && prestigeScore >= 30) return "stretch";
  if (score >= 58) return "primary";
  return "backup";
}

function classifyRisk(tier: RecommendationTier, prestigeScore: number): RecommendationRiskLevel {
  if (tier === "stretch" || prestigeScore >= 34) return "high";
  if (tier === "primary" || prestigeScore >= 20) return "medium";
  return "low";
}

function buildRiskTips(
  input: VenueRecommendationInput,
  venue: (typeof POPULAR_VENUES)[number],
  riskLevel: RecommendationRiskLevel,
  matchTags: string[]
): string[] {
  const tips: string[] = [];
  if (riskLevel === "high") {
    tips.push("竞争强度高，建议在创新性、实验充分性和相关工作覆盖上预留额外修改时间。");
  }
  if (matchTags.length === 0) {
    tips.push("当前输入与刊会关键词重合较少，建议补充摘要、关键词或研究方向后再判断。");
  }
  if (input.timePreference === "fast" && venue.type === "conference") {
    tips.push("会议节奏受固定 DDL 和通知日期影响，若追求快速反馈可同时准备期刊备选。");
  }
  if (input.targetType !== "all" && input.targetType !== venue.type) {
    tips.push("目标类型与当前候选不一致，建议仅作为备选观察。");
  }
  if (tips.length === 0) {
    tips.push("匹配度和风险处于可控区间，可进入预审或投稿材料准备。");
  }
  return tips.slice(0, 3);
}

function buildRejectionReasons(
  input: VenueRecommendationInput,
  venue: (typeof POPULAR_VENUES)[number],
  riskLevel: RecommendationRiskLevel
): string[] {
  const reasons = [
    "贡献边界与该刊会关注主题不够贴合。",
    "实验设置、消融或对比基线不足以支撑主要结论。",
    "相关工作覆盖不足，难以体现相对已有工作的增量。",
  ];

  if (riskLevel === "high") {
    reasons.unshift("创新性或影响力未达到高档位刊会预期。");
  }
  if (venue.type === "conference") {
    reasons.push("篇幅受限导致方法细节、实验或附录支撑不足。");
  }
  if (input.abstract.trim().length < 120) {
    reasons.push("摘要信息较少，审稿人可能难以快速判断贡献与证据链。");
  }
  return reasons.slice(0, 4);
}

export function useVenueRecommendations(conferences: Conference[], journals: Journal[]) {
  const [showRecPanel, setShowRecPanel] = useState(false);
  const [recInput, setRecInput] = useState<VenueRecommendationInput>(INITIAL_RECOMMENDATION_INPUT);
  const [recommendations, setRecommendations] = useState<VenueRecommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const generateRecommendations = () => {
    setRecLoading(true);

    window.setTimeout(() => {
      const terms = tokenize(
        [
          recInput.title,
          recInput.abstract,
          recInput.keywords,
          recInput.direction,
          recInput.extra,
        ].join(" ")
      );
      const trackedNames = new Set([
        ...conferences.map((conference) => conference.name.split(" ")[0].toLowerCase()),
        ...journals.map((journal) => journal.name.toLowerCase()),
      ]);

      const results = POPULAR_VENUES.filter((venue) => !trackedNames.has(venue.name.split(" ")[0].toLowerCase()))
        .filter((venue) => recInput.targetType === "all" || venue.type === recInput.targetType)
        .map((venue) => {
          const haystack = `${venue.name} ${venue.fullName} ${venue.area}`.toLowerCase();
          const matchTags = Array.from(new Set(terms.filter((term) => haystack.includes(term)))).slice(0, 6);
          const prestigeScore = getPrestigeScore(venue.ccf, venue.sci, venue.sciQuartile);
          const keywordScore = Math.min(30, matchTags.length * 9);
          const rankScore = getRankFit(recInput, venue);
          const riskScore = getRiskFit(recInput.riskPreference, prestigeScore);
          const timeScore =
            recInput.timePreference === "fast"
              ? venue.type === "journal" ? 8 : 2
              : recInput.timePreference === "normal"
                ? 5
                : 4;
          const baseScore = 18 + keywordScore + prestigeScore + rankScore + riskScore + timeScore + deterministicJitter(venue.id);
          const matchScore = Math.max(28, Math.min(98, baseScore));
          const tier = classifyTier(matchScore, recInput.riskPreference, prestigeScore);
          const riskLevel = classifyRisk(tier, prestigeScore);
          const reason = [
            `${venue.area} 方向匹配${matchTags.length > 0 ? `，命中 ${matchTags.slice(0, 3).join("、")}` : "，但需要补充更多论文信息"}`,
            venue.ccf !== "none" ? `CCF ${venue.ccf} 档位` : venue.sci ? `SCI${venue.sciQuartile ? ` ${venue.sciQuartile}` : ""}` : "综合候选",
            tier === "stretch" ? "适合作为冲刺目标" : tier === "primary" ? "适合作为主投目标" : "适合作为保底或转投备选",
          ].join("；");

          return {
            ...venue,
            reason,
            matchScore,
            matchTags,
            tier,
            riskLevel,
            riskTips: buildRiskTips(recInput, venue, riskLevel, matchTags),
            rejectionReasons: buildRejectionReasons(recInput, venue, riskLevel),
          } satisfies VenueRecommendation;
        })
        .filter((recommendation) => recommendation.matchScore >= 30)
        .sort((left, right) => {
          const tierOrder: Record<RecommendationTier, number> = { stretch: 0, primary: 1, backup: 2 };
          return tierOrder[left.tier] - tierOrder[right.tier] || right.matchScore - left.matchScore;
        })
        .slice(0, 12);

      setRecommendations(results);
      setRecLoading(false);
    }, 500);
  };

  return {
    showRecPanel,
    recInput,
    recommendations,
    recLoading,
    setShowRecPanel,
    setRecInput,
    generateRecommendations,
  };
}
