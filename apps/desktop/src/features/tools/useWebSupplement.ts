import { useState } from "react";
import type { WebSearchOutcome } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

/**
 * 论文检索「网络补充」：复用对话的联网搜索能力（web_search_query），
 * 在学术数据源之外按需补一份全网结果，与论文检索的主流程解耦、按需触发。
 */
export function useWebSupplement() {
  const [outcome, setOutcome] = useState<WebSearchOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const run = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    try {
      setLoading(true);
      setError("");
      setSearched(true);
      const result = await apiClient.webSearch.query(trimmed);
      setOutcome(result);
    } catch (nextError) {
      setOutcome(null);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return { outcome, loading, error, searched, run };
}
