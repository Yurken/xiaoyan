import { useLocalSearchParams } from "expo-router";
import { usePaperDetail } from "../../features/papers/usePaperDetail";
import { PaperDetailView } from "../../features/papers/PaperDetailView";

export default function PaperDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const { paper, loading, error, source, analyzing, canAnalyze, reload, analyze } =
    usePaperDetail(id);

  return (
    <PaperDetailView
      paper={paper}
      loading={loading}
      error={error}
      source={source}
      analyzing={analyzing}
      canAnalyze={canAnalyze}
      onReload={() => { void reload(); }}
      onAnalyze={() => { void analyze(); }}
    />
  );
}
