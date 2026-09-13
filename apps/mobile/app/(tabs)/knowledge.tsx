import { colors } from "../../features/theme";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { useKnowledgeNotes } from "../../features/knowledge/useKnowledgeNotes";
import type { KnowledgeNote } from "@research-copilot/types";

export default function KnowledgeScreen() {
  const {
    notes,
    search,
    setSearch,
    loading,
    refreshing,
    error,
    refresh,
  } = useKnowledgeNotes();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>知识库</Text>
          <Text style={styles.subtitle}>
            {notes.length > 0 ? `共 ${notes.length} 条笔记` : "分析论文后小妍会自动生成"}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="请输入关键词搜索笔记"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : notes.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="book-outline" size={40} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>
            {search ? "未找到相关笔记" : "暂无笔记"}
          </Text>
          <Text style={styles.emptyText}>
            {search ? "请尝试更换关键词" : "分析论文后小妍会自动生成知识卡片"}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          <FlatList<KnowledgeNote>
            data={notes}
            keyExtractor={(n) => n.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            refreshing={refreshing}
            onRefresh={() => { void refresh(); }}
            renderItem={({ item }: { item: KnowledgeNote }) => (
              <View style={styles.noteItem}>
                <NmCard style={styles.noteCard}>
                  <Text style={styles.noteTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.noteContent} numberOfLines={4}>{item.content}</Text>
                  <Text style={styles.noteDate}>
                    {new Date(item.created_at).toLocaleDateString("zh-CN")}
                  </Text>
                </NmCard>
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: colors.bgInput },
  header:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:       { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  subtitle:    { fontSize: 14, color: colors.textMuted, marginTop: 2 },

  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { fontSize: 13, color: colors.danger, fontWeight: "500" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.bgInput,
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary },

  grid:   { paddingHorizontal: 20, paddingBottom: 20 },
  noteItem: { flex: 1, marginBottom: 12 },
  noteCard: { flex: 1, padding: 14, gap: 6 },
  noteTitle:   { fontSize: 14, fontWeight: "600", color: colors.textPrimary, lineHeight: 20 },
  noteContent: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  noteDate:    { fontSize: 11, color: colors.textMuted, marginTop: "auto" },

  center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: colors.bg,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.textSecondary },
  emptyText:  { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingHorizontal: 40 },
});
