import { colors } from "../../features/theme";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { Paper } from "@research-copilot/types";
import { PaperListItem } from "../../features/papers/PaperListItem";
import { usePaperLibrary } from "../../features/papers/usePaperLibrary";

const ANALYZE_ERRORS = new Set([
  "分析未启动，请检查网络或稍后重试",
  "当前为只读同步副本，连接后端后才能分析",
  "无法连接后端，暂时不能分析",
]);

export default function PapersScreen() {
  const {
    papers,
    progressMap,
    loading,
    refreshing,
    source,
    error,
    refresh,
    analyze,
    canAnalyze,
    clearError,
  } = usePaperLibrary();

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
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const showSynced = source === "synced";
  const showError = source === "unavailable" || Boolean(error);
  const dismissable = Boolean(error && ANALYZE_ERRORS.has(error));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>论文库</Text>
          <Text style={styles.subtitle}>共 {papers.length} 篇</Text>
        </View>
      </View>

      {showSynced && (
        <View style={styles.syncedBanner}>
          <Text style={styles.syncedText}>正在浏览 WebDAV 同步副本 · 只读</Text>
        </View>
      )}

      {showError && error ? (
        <View style={[styles.errorBanner, source === "unavailable" ? styles.errorBannerRed : styles.errorBannerOrange]}>
          <Text style={styles.errorText}>{error}</Text>
          {dismissable ? (
            <TouchableOpacity onPress={clearError} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.danger} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {papers.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
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
            onRefresh={() => { void refresh(); }}
            renderItem={({ item }: { item: Paper }) => (
              <View style={styles.paperItem}>
                <PaperListItem
                  paper={item}
                  progress={progressMap[item.id]}
                  canAnalyze={canAnalyze}
                  onAnalyze={(id) => { void analyze(id); }}
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
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title:    { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  syncedBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
  },
  syncedText: { fontSize: 13, color: colors.accentStrong, fontWeight: "500" },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBannerRed: { backgroundColor: colors.dangerSoft },
  errorBannerOrange: { backgroundColor: colors.warningSoft },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: "500" },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  paperItem: { marginBottom: 12 },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.textSecondary },
  emptyText:  { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingHorizontal: 40 },
});
