import { useState } from "react";
import type { GithubProjectSearchResponse } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

export function useGithubProjectSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GithubProjectSearchResponse | null>(null);
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
      const response = await apiClient.githubProject.search(trimmed, 8);
      setResult(response);
    } catch (nextError) {
      setResult(null);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return {
    query,
    setQuery,
    result,
    loading,
    error,
    searched,
    submit,
  };
}
