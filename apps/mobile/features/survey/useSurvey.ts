import { useState } from "react";
import { apiClient } from "../../lib/client";
import { normalizeSurvey, type SurveyData } from "./shared";

export function useSurvey() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const raw = (await apiClient.survey.generate(trimmed)) as Record<string, unknown>;
      setResult(normalizeSurvey(raw, trimmed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, error, generate };
}
