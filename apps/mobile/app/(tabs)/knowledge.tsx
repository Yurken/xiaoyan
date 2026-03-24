import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { apiClient } from "../../lib/client";
import type { KnowledgeNote } from "@research-copilot/types";

export default function KnowledgeScreen() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await apiClient.knowledge.listNotes(search || undefined);
      setNotes(data);
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
        <Ionicons name="search" size={16} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="请输入关键词搜索笔记"
          placeholderTextColor="#8E8E93"
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
            <Ionicons name="book-outline" size={40} color="#8E8E93" />
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
  screen:      { flex: 1, backgroundColor: "#E8ECF0" },
  header:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:       { fontSize: 28, fontWeight: "700", color: "#1C1C1E" },
  subtitle:    { fontSize: 14, color: "#8E8E93", marginTop: 2 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#E8ECF0",
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.5)",
    height: 44,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#1C1C1E" },

  grid:   { paddingHorizontal: 20, paddingBottom: 20 },
  noteItem: { flex: 1, marginBottom: 12 },
  noteCard: { flex: 1, padding: 14, gap: 6 },
  noteTitle:   { fontSize: 14, fontWeight: "600", color: "#1C1C1E", lineHeight: 20 },
  noteContent: { fontSize: 13, color: "#3C3C43", lineHeight: 18 },
  noteDate:    { fontSize: 11, color: "#8E8E93", marginTop: "auto" },

  center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: "#E8ECF0",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(200,205,211,0.5)",
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#3C3C43" },
  emptyText:  { fontSize: 14, color: "#8E8E93", textAlign: "center", paddingHorizontal: 40 },
});
