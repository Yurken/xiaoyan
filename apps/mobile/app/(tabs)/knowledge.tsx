import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { getRecords } from "../../features/sync/localStore";
import type { KnowledgeNote } from "@research-copilot/types";

export default function KnowledgeScreen() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      // 数据来自 WebDAV 同步下来的本地缓存（桌面端生成 → 同步 → 本机查阅）。
      const all = await getRecords<KnowledgeNote>("knowledge_notes");
      const keyword = search.trim().toLowerCase();
      setNotes(
        keyword
          ? all.filter(
              (note) =>
                note.title?.toLowerCase().includes(keyword) || note.content?.toLowerCase().includes(keyword),
            )
          : all,
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

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

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#5F6B7A" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="请输入关键词搜索笔记"
          placeholderTextColor="#5F6B7A"
          returnKeyType="search"
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : notes.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="book-outline" size={40} color="#5F6B7A" />
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
            onRefresh={() => { setRefreshing(true); load(true); }}
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
  screen:      { flex: 1, backgroundColor: "#0F141C" },
  header:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:       { fontSize: 28, fontWeight: "700", color: "#F5F7FA" },
  subtitle:    { fontSize: 14, color: "#5F6B7A", marginTop: 2 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#0F141C",
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.5)",
    height: 44,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#F5F7FA" },

  grid:   { paddingHorizontal: 20, paddingBottom: 20 },
  noteItem: { flex: 1, marginBottom: 12 },
  noteCard: { flex: 1, padding: 14, gap: 6 },
  noteTitle:   { fontSize: 14, fontWeight: "600", color: "#F5F7FA", lineHeight: 20 },
  noteContent: { fontSize: 13, color: "#9AA7B8", lineHeight: 18 },
  noteDate:    { fontSize: 11, color: "#5F6B7A", marginTop: "auto" },

  center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: "#090B10",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(60,74,92,0.5)",
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#9AA7B8" },
  emptyText:  { fontSize: 14, color: "#5F6B7A", textAlign: "center", paddingHorizontal: 40 },
});
