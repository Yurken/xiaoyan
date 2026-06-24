import { useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface CrossPaperEntry {
  index: number;
  title: string;
  authors: string;
  year: number | null;
  venue: string;
}

interface CrossPaperAnalysisState {
  loading: boolean;
  error: string;
  result: { papers: CrossPaperEntry[]; analysis: string } | null;
}

function rowToCrossPaperEntry(row: unknown, fallbackIndex: number): CrossPaperEntry {
  const r = (row ?? {}) as Record<string, unknown>;
  const yearRaw = r.year;
  const year = yearRaw == null || yearRaw === "" ? null : Number(yearRaw);
  return {
    index: typeof r.index === "number" ? r.index : fallbackIndex,
    title: String(r.title ?? ""),
    authors: String(r.authors ?? ""),
    year: year != null && Number.isFinite(year) ? year : null,
    venue: String(r.venue ?? ""),
  };
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
      const raw = await apiClient.crossAnalysis.analyze(paperIds);
      const result = {
        papers: raw.papers.map(rowToCrossPaperEntry),
        analysis: raw.analysis,
      };
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
