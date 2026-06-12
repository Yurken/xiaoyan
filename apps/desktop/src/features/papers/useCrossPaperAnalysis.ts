import { useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface CrossPaperAnalysisState {
  loading: boolean;
  error: string;
  result: { papers: Array<{ index: number; title: string; authors: string; year: number | null; venue: string }>; analysis: string } | null;
}

export function useCrossPaperAnalysis() {
  const [state, setState] = useState<CrossPaperAnalysisState>({
    loading: false,
    error: "",
    result: null,
  });

  const analyze = async (paperIds: string[]) => {
    if (paperIds.length < 2) {
      setState((s) => ({ ...s, error: "请至少选择 2 篇论文。" }));
      return;
    }

    setState({ loading: true, error: "", result: null });
    try {
      const result = await apiClient.crossAnalysis.analyze(paperIds);
      setState({ loading: false, error: "", result });
    } catch (err) {
      setState({ loading: false, error: formatErrorMessage(err), result: null });
    }
  };

  const reset = () => {
    setState({ loading: false, error: "", result: null });
  };

  return { ...state, analyze, reset };
}
