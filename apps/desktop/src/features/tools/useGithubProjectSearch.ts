import { useEffect, useState } from "react";
import type { GithubProjectSearchResponse, GithubProjectSearchHistoryEntry } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

export function useGithubProjectSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GithubProjectSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [history, setHistory] = useState<GithubProjectSearchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const items = await apiClient.githubProject.getSearchHistory(20);
      setHistory(items);
    } catch (nextError) {
      console.error("加载 GitHub 搜索历史失败：", nextError);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    try {
      setLoading(true);
      setSearched(true);
      setError("");
      const response = await apiClient.githubProject.search(trimmed, 8);
      setResult(response);
      try {
        await apiClient.githubProject.saveSearchHistory(trimmed, response);
        await loadHistory();
      } catch (historyError) {
        console.error("保存 GitHub 搜索历史失败：", historyError);
      }
    } catch (nextError) {
      setResult(null);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const applyHistory = (entry: GithubProjectSearchHistoryEntry) => {
    setQuery(entry.query);
    if (entry.result_json) {
      try {
        const parsed = JSON.parse(entry.result_json) as GithubProjectSearchResponse;
        setResult(parsed);
      } catch {
        setResult(null);
      }
    } else {
      setResult(null);
    }
    setSearched(true);
    setError("");
  };

  const removeHistory = async (id: string) => {
    await apiClient.githubProject.deleteSearchHistory(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  return {
    query,
    setQuery,
    result,
    loading,
    error,
    searched,
    history,
    historyLoading,
    submit,
    applyHistory,
    removeHistory,
    refreshHistory: loadHistory,
  };
}
