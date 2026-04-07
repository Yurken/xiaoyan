import { useState } from "react";
import type { SourceLookupSection } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

export function useSourceLookup() {
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<SourceLookupSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    try {
      setLoading(true);
      setSearched(true);
      setError("");
      const result = await apiClient.sources.lookup(trimmed, 10);
      setSections(result.sections ?? []);
    } catch (nextError) {
      setSections([]);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return {
    query,
    sections,
    loading,
    error,
    searched,
    setQuery,
    submit,
  };
}
