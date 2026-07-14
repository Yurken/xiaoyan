import { useMemo, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import {
  buildAiPatentPrompt,
  buildPatentabilityReport,
  buildPatentSearchPlan,
  rankPatentResults,
  type DisclosureStatus,
  type PatentSearchResult,
} from "./shared";

export function usePatentSearch() {
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [disclosureStatus, setDisclosureStatus] = useState<DisclosureStatus>("private");
  const [results, setResults] = useState<PatentSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const plan = useMemo(() => buildPatentSearchPlan(description, keywords), [description, keywords]);
  const report = useMemo(() => buildPatentabilityReport(results, disclosureStatus), [disclosureStatus, results]);

  const search = async () => {
    if (!description.trim() || loading) return;
    try {
      setLoading(true);
      setError("");
      setSearched(true);
      setAiReport("");
      const outcome = await apiClient.webSearch.query(plan.webQuery);
      setProvider(outcome.provider);
      setResults(rankPatentResults(outcome.items, plan));
    } catch (nextError) {
      setResults([]);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const generateAiReport = async () => {
    if (!description.trim() || results.length === 0 || aiLoading) return;
    try {
      setAiLoading(true);
      setAiError("");
      setAiReport("");
      let content = "";
      for await (const chunk of apiClient.chat.stream({
        message: buildAiPatentPrompt(description, plan, results, disclosureStatus),
        chat_mode: "direct",
        tag: "1",
      })) {
        if (chunk.type === "delta") {
          content += chunk.value;
          setAiReport(content);
        } else if (chunk.type === "error") {
          throw new Error(String(chunk.value));
        }
      }
    } catch (nextError) {
      setAiError(formatErrorMessage(nextError));
    } finally {
      setAiLoading(false);
    }
  };

  return {
    description,
    keywords,
    disclosureStatus,
    plan,
    results,
    report,
    searched,
    loading,
    error,
    provider,
    aiReport,
    aiLoading,
    aiError,
    setDescription,
    setKeywords,
    setDisclosureStatus,
    search,
    generateAiReport,
  };
}
