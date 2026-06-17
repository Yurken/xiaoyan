import type { LearningPath } from "@research-copilot/types";

// 规划接口返回结构不固定：可能裹一层 data、或把路径放在 plan 字段。统一摊平成 LearningPath。
export function normalizeLearningPath(raw: Record<string, unknown>): LearningPath | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.data && typeof raw.data === "object") {
    return normalizeLearningPath(raw.data as Record<string, unknown>);
  }
  const path = (raw.plan && typeof raw.plan === "object" ? raw.plan : raw) as LearningPath;
  const hasContent =
    path.overview ||
    (path.prerequisites?.length ?? 0) > 0 ||
    (path.learning_stages?.length ?? 0) > 0 ||
    (path.classic_papers?.length ?? 0) > 0 ||
    (path.research_directions?.length ?? 0) > 0;
  return hasContent ? path : null;
}

export function splitKeywords(input: string): string[] {
  return input
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
