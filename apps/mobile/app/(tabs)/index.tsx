import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { NmCard } from "../../components/NmCard";
import { NmButton } from "../../components/NmButton";
import { apiClient } from "../../lib/client";
import type { Paper } from "@research-copilot/types";

const STATUS_CONFIG = {
  analyzed:  { icon: "checkmark-circle" as const, color: "#34C759", label: "已分析" },
  analyzing: { icon: "hourglass"         as const, color: "#007AFF", label: "处理中" },
  failed:    { icon: "close-circle"      as const, color: "#FF3B30", label: "失败"   },
  pending:   { icon: "ellipse-outline"   as const, color: "#5F6B7A", label: "待分析" },
};

const CCF_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#2D1518", text: "#FF6B6B" },
  B: { bg: "#2D1F12", text: "#FF9F43" },
  C: { bg: "#1A1830", text: "#A29BFE" },
};

const INDEX_TAGS: Record<string, { bg: string; text: string }> = {
  SCI:  { bg: "#122A1E", text: "#4ADE80" },
  SSCI: { bg: "#122A1E", text: "#4ADE80" },
  EI:   { bg: "#122A1E", text: "#4ADE80" },
};

function buildTags(paper: Paper): Array<{ label: string; bg: string; text: string }> {
  const tags: Array<{ label: string; bg: string; text: string }> = [];
  if (paper.ccf_rating) {
    const c = CCF_COLORS[paper.ccf_rating] ?? { bg: "#12202E", text: "#60A5FA" };
    tags.push({ label: `CCF ${paper.ccf_rating}`, bg: c.bg, text: c.text });
  }
  if (paper.wos_indexes) {
    for (const idx of paper.wos_indexes) {
      const c = INDEX_TAGS[idx];
      if (c) tags.push({ label: idx, bg: c.bg, text: c.text });
    }
  }
  if (paper.jcr_quartile) {
    tags.push({ label: paper.jcr_quartile, bg: "#1A1830", text: "#A29BFE" });
  }
  if (paper.cas_quartile) {
    tags.push({ label: `中科院${paper.cas_quartile}`, bg: "#12202E", text: "#60A5FA" });
  }
  if (paper.cas_top) {
    tags.push({ label: "顶刊", bg: "#2D1518", text: "#FF6B6B" });
  }
  return tags;
}

function PaperItem({
  paper,
  progress,
  onAnalyze,
  onPress,
}: {
  paper: Paper;
  progress?: number;
  onAnalyze: (id: string) => void;
  onPress: (id: string) => void;
}) {
  const s = STATUS_CONFIG[paper.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const tags = buildTags(paper);

  return (
    <NmCard style={styles.paperCard}>
      <TouchableOpacity
        style={styles.paperTouchable}
        activeOpacity={0.65}
        onPress={() => onPress(paper.id)}
      >
        <View style={styles.paperInfo}>
          <Text style={styles.paperTitle} numberOfLines={2}>{paper.title}</Text>
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((t) => (
                <View key={t.label} style={[styles.tag, { backgroundColor: t.bg }]}>
                  <Text style={[styles.tagText, { color: t.text }]}>{t.label}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.paperMeta}>
            <Text style={styles.paperDate}>
              {new Date(paper.created_at).toLocaleDateString("zh-CN")}
            </Text>
            <View style={styles.statusBadge}>
              <Ionicons name={s.icon} size={12} color={s.color} />
              <Text style={[styles.paperStatus, { color: s.color }]}>
                {s.label}
                {paper.status === "analyzing" && progress != null ? ` ${progress}%` : ""}
              </Text>
            </View>
          </View>
          {paper.status === "analyzing" && progress != null && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          )}
        </View>
      </TouchableOpacity>
      <NmButton
        variant="secondary"
        size="sm"
        disabled={paper.status === "analyzing"}
        style={styles.analyzeBtn}
        onPress={() => onAnalyze(paper.id)}
      >
        小妍分析
      </NmButton>
    </NmCard>
  );
}

export default function PapersScreen() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
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
    const previous = papers.find((p) => p.id === id);
    setPapers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "analyzing" } : p))
    );

    try {
      const result = await apiClient.papers.analyze(id) as { job_id?: string };
      if (result?.job_id) {
        for await (const job of apiClient.jobs.poll(result.job_id)) {
          setProgressMap((prev) => ({ ...prev, [id]: job.progress }));
          if (job.status === "done" || job.status === "failed") {
            break;
          }
        }
      }
      await load(true);
      setProgressMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      if (previous) {
        setPapers((prev) => prev.map((p) => (p.id === id ? previous : p)));
      }
      Alert.alert("分析未启动", error instanceof Error ? error.message : "请检查网络或稍后重试。");
    }
  };

  const handleNavigate = (id: string) => {
    router.push(`/paper/${id}`);
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
            <Ionicons name="document-text-outline" size={40} color="#5F6B7A" />
          </View>
          <Text style={styles.emptyTitle}>暂无论文</Text>
          <Text style={styles.emptyText}>在桌面端导入 PDF 后即可在此浏览，小妍会帮你分析论文内容</Text>
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
                <PaperItem
                  paper={item}
                  progress={progressMap[item.id]}
                  onAnalyze={handleAnalyze}
                  onPress={handleNavigate}
                />
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#090B10" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title:    { fontSize: 28, fontWeight: "700", color: "#F5F7FA" },
  subtitle: { fontSize: 14, color: "#5F6B7A", marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  paperItem: { marginBottom: 12 },
  paperCard: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  paperTouchable: { flex: 1 },
  paperInfo: { flex: 1 },
  paperTitle: { fontSize: 16, fontWeight: "600", color: "#F5F7FA", lineHeight: 22 },
  tagsRow:   { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText:   { fontSize: 11, fontWeight: "600" },
  paperMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  paperDate: { fontSize: 12, color: "#5F6B7A" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  paperStatus: { fontSize: 12, fontWeight: "500" },
  analyzeBtn: { flexShrink: 0 },

  progressBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(0,122,255,0.15)",
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#007AFF",
  },

  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#141A23",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.5)",
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#9AA7B8" },
  emptyText:  { fontSize: 14, color: "#5F6B7A", textAlign: "center", paddingHorizontal: 40 },
});
