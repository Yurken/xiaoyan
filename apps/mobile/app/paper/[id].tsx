import { useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
import { usePaperDetail } from "../../features/papers/usePaperDetail";
import { PaperDetailView } from "../../features/papers/PaperDetailView";
import { apiClient } from "../../lib/client";

export default function PaperDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paper, loading, error, reload } = usePaperDetail(id);

  const handleAnalyze = async () => {
    try {
      await apiClient.papers.analyze(id);
      reload();
    } catch (e) {
      Alert.alert("分析未启动", e instanceof Error ? e.message : "请检查网络连接。");
    }
  };

  return (
    <PaperDetailView
      paper={paper}
      loading={loading}
      error={error}
      onReload={reload}
      onAnalyze={handleAnalyze}
    />
  );
}
