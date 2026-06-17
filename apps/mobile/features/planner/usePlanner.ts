import { useState } from "react";
import { apiClient } from "../../lib/client";
import type { LearningPath } from "@research-copilot/types";
import { normalizeLearningPath, splitKeywords } from "./shared";

export function usePlanner() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LearningPath | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (topic: string, keywords: string) => {
    const trimmed = topic.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const raw = (await apiClient.planner.generate(
        trimmed,
        splitKeywords(keywords)
      )) as Record<string, unknown>;
      const path = normalizeLearningPath(raw);
      if (!path) throw new Error("小妍没有返回可用的学习路径，请换个说法再试一次。");
      setResult(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, error, generate };
}
