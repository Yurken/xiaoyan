import { useMemo, useRef, useState } from "react";
import type { ArxivRankingMode, ArxivSearchRequest, ArxivSearchResponse } from "@research-copilot/types";
import { buildAppliedFilterEntries, hasStructuredArxivTerms, splitStructuredInput } from "./shared";
import { apiClient, formatErrorMessage } from "../../lib/client";

export function useArxivFieldSearch() {
  const [topic, setTopic] = useState("");
  const [allTerms, setAllTerms] = useState("");
  const [titleTerms, setTitleTerms] = useState("");
  const [abstractTerms, setAbstractTerms] = useState("");
  const [authors, setAuthors] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [commentsTerms, setCommentsTerms] = useState("");
  const [journalTerms, setJournalTerms] = useState("");
  const [excludeTerms, setExcludeTerms] = useState("");
  const [days, setDays] = useState("30");
  const [limit, setLimit] = useState("8");
  const [mode, setMode] = useState<ArxivRankingMode>("relevance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<ArxivSearchResponse | null>(null);
  const lastSearchAt = useRef<number>(0);

  const request = useMemo<ArxivSearchRequest>(
    () => ({
      topic: topic.trim(),
      all_terms: splitStructuredInput(allTerms),
      title_terms: splitStructuredInput(titleTerms),
      abstract_terms: splitStructuredInput(abstractTerms),
      authors: splitStructuredInput(authors),
      categories,
      comments_terms: splitStructuredInput(commentsTerms),
      journal_ref_terms: splitStructuredInput(journalTerms),
      exclude_terms: splitStructuredInput(excludeTerms),
    }),
    [abstractTerms, allTerms, authors, categories, commentsTerms, excludeTerms, journalTerms, titleTerms, topic],
  );
  const hasSearchTerms = useMemo(() => hasStructuredArxivTerms(request), [request]);
  const appliedFilters = useMemo(() => buildAppliedFilterEntries(result?.applied_filters), [result]);

  const submit = async () => {
    if (!hasSearchTerms || loading) return;

    const now = Date.now();
    if (now - lastSearchAt.current < 3000) return;
    lastSearchAt.current = now;

    const parsedDays = Number(days);
    const parsedLimit = Number(limit);

    try {
      setLoading(true);
      setError("");
      setSearched(true);
      const nextResult = await apiClient.arxiv.search(
        request,
        Number.isFinite(parsedDays) ? parsedDays : 30,
        Number.isFinite(parsedLimit) ? parsedLimit : 8,
        mode,
      );
      setResult(nextResult);
    } catch (nextError) {
      setResult(null);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (value: string) => {
    setCategories((prev) => (prev.includes(value) ? prev.filter((category) => category !== value) : [...prev, value]));
  };

  const removeCategory = (value: string) => {
    setCategories((prev) => prev.filter((category) => category !== value));
  };

  const clearCategories = () => {
    setCategories([]);
  };

  const toggleCategoryPicker = () => {
    setCategoryPickerOpen((prev) => !prev);
  };

  return {
    panelProps: {
      topic,
      allTerms,
      titleTerms,
      abstractTerms,
      authors,
      categories,
      categoryPickerOpen,
      commentsTerms,
      journalTerms,
      excludeTerms,
      days,
      limit,
      mode,
      loading,
      error,
      hasSearchTerms,
      onTopicChange: setTopic,
      onAllTermsChange: setAllTerms,
      onTitleTermsChange: setTitleTerms,
      onAbstractTermsChange: setAbstractTerms,
      onAuthorsChange: setAuthors,
      onToggleCategory: toggleCategory,
      onRemoveCategory: removeCategory,
      onClearCategories: clearCategories,
      onToggleCategoryPicker: toggleCategoryPicker,
      onCommentsTermsChange: setCommentsTerms,
      onJournalTermsChange: setJournalTerms,
      onExcludeTermsChange: setExcludeTerms,
      onDaysChange: setDays,
      onLimitChange: setLimit,
      onModeChange: setMode,
      onSubmit: submit,
    },
    resultProps: {
      result,
      appliedFilters,
      searched,
      loading,
      error,
    },
  };
}
