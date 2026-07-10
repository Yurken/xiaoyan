import { useCallback, useEffect, useState } from "react";
import type { SavedSurvey, SurveySummary } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { StructuredSurveyResult, SurveyPaperResult } from "./shared";

/** 已保存综述 → 结果工作区可渲染的结构，复用 SurveyStructuredReport 等子组件。 */
export function savedSurveyToStructured(survey: SavedSurvey): StructuredSurveyResult {
  const rawCitations = survey.formatted_citations as unknown[] | undefined;
  const formattedCitations = Array.isArray(rawCitations)
    ? rawCitations.filter((item): item is string => typeof item === "string")
    : [];

  return {
    query: survey.query,
    report: (survey.report ?? {}) as StructuredSurveyResult["report"],
    papers: (survey.papers as SurveyPaperResult[] | undefined) ?? [],
    formatted_citations: formattedCitations,
    citation_format: survey.citation_format ?? undefined,
    meta: (survey.meta ?? undefined) as StructuredSurveyResult["meta"],
  };
}

export function useSurveyHistory() {
  const [items, setItems] = useState<SurveySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<SavedSurvey | null>(null);
  const [loadingActive, setLoadingActive] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await apiClient.survey.list());
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = useCallback(async (id: string) => {
    setLoadingActive(true);
    setError("");
    try {
      setActive(await apiClient.survey.get(id));
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setLoadingActive(false);
    }
  }, []);

  const close = useCallback(() => setActive(null), []);

  const remove = useCallback(async (id: string) => {
    setRemovingId(id);
    try {
      await apiClient.survey.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setActive((current) => (current?.id === id ? null : current));
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setRemovingId(null);
    }
  }, []);

  return { items, loading, error, active, loadingActive, removingId, reload, open, close, remove };
}
