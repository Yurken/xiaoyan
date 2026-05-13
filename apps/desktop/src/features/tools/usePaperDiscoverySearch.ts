import { useEffect, useMemo, useRef, useState } from "react";
import type { ArxivRankingMode, ArxivSearchRequest, ArxivSearchResponse } from "@research-copilot/types";
import {
  DOMAIN_VENUES,
  RANK_OPTIONS,
  buildAppliedFilterEntries,
  computeStaticVenues,
  hasStructuredArxivTerms,
  splitStructuredInput,
  type RankKey,
} from "./shared";
import { apiClient, formatErrorMessage, journalApi } from "../../lib/client";

export function usePaperDiscoverySearch() {
  const [topic, setTopic] = useState("");
  const [allTerms, setAllTerms] = useState("");
  const [titleTerms, setTitleTerms] = useState("");
  const [abstractTerms, setAbstractTerms] = useState("");
  const [authors, setAuthors] = useState("");
  const [commentsTerms, setCommentsTerms] = useState("");
  const [excludeTerms, setExcludeTerms] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [venueType, setVenueType] = useState<"all" | "conference" | "journal">("all");
  const [selectedRanks, setSelectedRanks] = useState<RankKey[]>([]);
  const [venueFilterLoading, setVenueFilterLoading] = useState(false);
  const [dynamicJournalTerms, setDynamicJournalTerms] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [journalTerms, setJournalTerms] = useState("");
  const [days, setDays] = useState("14");
  const [limit, setLimit] = useState("6");
  const [mode, setMode] = useState<ArxivRankingMode>("relevance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<ArxivSearchResponse | null>(null);
  const lastSearchAt = useRef<number>(0);

  useEffect(() => {
    if (selectedDomains.length === 0 || selectedRanks.length === 0) {
      setVenueFilterLoading(false);
      setCategories([]);
      setJournalTerms("");
      setDynamicJournalTerms([]);
      return;
    }

    const { categories: staticCategories, journalTerms: staticTerms } = computeStaticVenues(
      selectedDomains,
      venueType,
      selectedRanks,
    );
    setCategories(staticCategories);

    const dynamicRanks = selectedRanks.filter((rank) => RANK_OPTIONS.find((option) => option.key === rank)?.dynamic);
    if (dynamicRanks.length === 0) {
      setVenueFilterLoading(false);
      setDynamicJournalTerms([]);
      setJournalTerms(staticTerms.join(", "));
      return;
    }

    if (venueType === "conference") {
      setVenueFilterLoading(false);
      setDynamicJournalTerms([]);
      setJournalTerms(staticTerms.join(", "));
      return;
    }

    const wosCategories = [...new Set(selectedDomains.flatMap((domainKey) => DOMAIN_VENUES[domainKey]?.wosCats ?? []))];
    setVenueFilterLoading(true);
    let cancelled = false;
    journalApi.rankFilter(wosCategories, dynamicRanks).then((titles) => {
      if (cancelled) return;
      setDynamicJournalTerms(titles);
      setJournalTerms([...new Set([...staticTerms, ...titles])].join(", "));
    }).catch(() => {
      if (cancelled) return;
      setDynamicJournalTerms([]);
      setJournalTerms(staticTerms.join(", "));
    }).finally(() => {
      if (cancelled) return;
      setVenueFilterLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDomains, selectedRanks, venueType]);

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
      const nextResult = await apiClient.paperSearch.search(
        request,
        Number.isFinite(parsedDays) ? parsedDays : 14,
        Number.isFinite(parsedLimit) ? parsedLimit : 6,
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

  return {
    panelProps: {
      topic,
      allTerms,
      titleTerms,
      abstractTerms,
      authors,
      commentsTerms,
      excludeTerms,
      selectedDomains,
      venueType,
      selectedRanks,
      venueFilterLoading,
      dynamicJournalTerms,
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
      onCommentsTermsChange: setCommentsTerms,
      onExcludeTermsChange: setExcludeTerms,
      onDomainsChange: setSelectedDomains,
      onVenueTypeChange: setVenueType,
      onRanksChange: setSelectedRanks,
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
