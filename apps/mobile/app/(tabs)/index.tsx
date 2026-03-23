import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { NmButton } from "../../components/NmButton";
import { apiClient } from "../../lib/client";
import type { Paper } from "@research-copilot/types";

const STATUS_CONFIG = {
  analyzed:  { icon: "checkmark-circle" as const, color: "#34C759", label: "已分析" },
  analyzing: { icon: "hourglass"         as const, color: "#007AFF", label: "处理中" },
  failed:    { icon: "close-circle"      as const, color: "#FF3B30", label: "失败"   },
  pending:   { icon: "ellipse-outline"   as const, color: "#8E8E93", label: "待分析" },
};

function PaperItem({ paper, onAnalyze }: { paper: Paper; onAnalyze: (id: string) => void }) {
  const s = STATUS_CONFIG[paper.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

  return (
    <NmCard style={styles.paperCard}>
      <View style={styles.paperRow}>
        <View style={styles.statusIcon}>
          <Ionicons name={s.icon} size={22} color={s.color} />
        </View>
        <View style={styles.paperInfo}>
          <Text style={styles.paperTitle} numberOfLines={2}>{paper.title}</Text>
          <Text style={styles.paperDate}>
            {new Date(paper.created_at).toLocaleDateString("zh-CN")}
            {"  "}
            <Text style={[styles.paperStatus, { color: s.color }]}>{s.label}</Text>
          </Text>
        </View>
        <NmButton
          variant="secondary"
          size="sm"
          disabled={paper.status === "analyzing"}
          onPress={() => onAnalyze(paper.id)}
        >
          小妍分析
        </NmButton>
      </View>
    </NmCard>
  );
}

export default function PapersScreen() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await apiClient.papers.list();
      setPapers(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAnalyze = async (id: string) => {
    await apiClient.papers.analyze(id);
    setPapers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "analyzing" } : p))
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>论文库</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>论文库</Text>
          <Text style={styles.subtitle}>共 {papers.length} 篇</Text>
        </View>
      </View>

      {papers.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={40} color="#8E8E93" />
          </View>
          <Text style={styles.emptyTitle}>暂无论文</Text>
          <Text style={styles.emptyText}>在桌面端导入 PDF 后即可在此浏览</Text>
        </View>
      ) : (
        <View style={styles.list}>
          <FlatList<Paper>
            data={papers}
            keyExtractor={(p) => p.id}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            renderItem={({ item }: { item: Paper }) => (
              <View style={styles.paperItem}>
                <PaperItem paper={item} onAnalyze={handleAnalyze} />
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#E8ECF0" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title:    { fontSize: 28, fontWeight: "700", color: "#1C1C1E" },
  subtitle: { fontSize: 14, color: "#8E8E93", marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  paperItem: { marginBottom: 12 },
  paperCard: { padding: 14 },
  paperRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E8ECF0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1C1C1E",
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.5)",
  },
  paperInfo: { flex: 1 },
  paperTitle: { fontSize: 14, fontWeight: "600", color: "#1C1C1E", lineHeight: 20 },
  paperDate:  { fontSize: 12, color: "#8E8E93", marginTop: 3 },
  paperStatus: { fontWeight: "500" },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#E8ECF0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.5)",
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#3C3C43" },
  emptyText:  { fontSize: 14, color: "#8E8E93", textAlign: "center", paddingHorizontal: 40 },
});
