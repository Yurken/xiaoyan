import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { PRODUCT_NAME, MAIN_ASSISTANT_NAME } from "@research-copilot/types";
import { NmCard } from "../../components/NmCard";
import { useWorkbench } from "../../features/home/useWorkbench";
import { colors } from "../../features/theme";

const ACTIONS: {
  key: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  route: string;
}[] = [
  { key: "planner", title: "研究规划", desc: "梳理学习路径", icon: "map-outline", tint: "#007AFF", route: "/planner" },
  { key: "survey", title: "文献综述", desc: "检索并生成综述", icon: "library-outline", tint: "#34C759", route: "/survey" },
];

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

export default function HomeScreen() {
  const { interests, recentPapers, loading, refreshing, refresh } = useWorkbench();

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        {/* 问候 */}
        <View style={styles.greeting}>
          <Text style={styles.hello}>{PRODUCT_NAME}</Text>
          <Text style={styles.helloSub}>{MAIN_ASSISTANT_NAME}陪你做科研，从规划到综述</Text>
        </View>

        {/* 快捷入口 */}
        <View style={styles.actionsRow}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.actionItem}
              activeOpacity={0.8}
              onPress={() => router.push(a.route as never)}
            >
              <NmCard style={styles.actionCard}>
                <View style={[styles.actionIcon, { backgroundColor: a.tint + "22" }]}>
                  <Ionicons name={a.icon} size={22} color={a.tint} />
                </View>
                <Text style={styles.actionTitle}>{a.title}</Text>
                <Text style={styles.actionDesc}>{a.desc}</Text>
              </NmCard>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* 研究方向 */}
            <View style={styles.section}>
              <SectionHeader title="研究方向" count={interests.length || undefined} />
              {interests.length === 0 ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/planner" as never)}>
                  <NmCard style={styles.emptyCard}>
                    <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                    <Text style={styles.emptyCardText}>还没有研究方向，去规划一个</Text>
                  </NmCard>
                </TouchableOpacity>
              ) : (
                <View style={styles.gap10}>
                  {interests.map((it) => (
                    <NmCard key={it.id} style={styles.interestCard}>
                      <Text style={styles.interestTopic} numberOfLines={1}>
                        {it.folder_name?.trim() || it.topic}
                      </Text>
                      {it.keywords && it.keywords.length > 0 ? (
                        <View style={styles.chipsRow}>
                          {it.keywords.slice(0, 4).map((k, i) => (
                            <View key={i} style={styles.chip}>
                              <Text style={styles.chipText}>{k}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </NmCard>
                  ))}
                </View>
              )}
            </View>

            {/* 最近论文 */}
            <View style={styles.section}>
              <SectionHeader title="最近论文" />
              {recentPapers.length === 0 ? (
                <NmCard style={styles.emptyCard}>
                  <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.emptyCardTextMuted}>在桌面端导入 PDF 后即可在此查阅</Text>
                </NmCard>
              ) : (
                <View style={styles.gap10}>
                  {recentPapers.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/paper/${p.id}`)}
                    >
                      <NmCard style={styles.paperCard}>
                        <View style={styles.flex1}>
                          <Text style={styles.paperTitle} numberOfLines={2}>{p.title}</Text>
                          <Text style={styles.paperMeta}>
                            {new Date(p.created_at).toLocaleDateString("zh-CN")}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </NmCard>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  flex1: { flex: 1 },
  gap10: { gap: 10 },

  greeting: { marginBottom: 20 },
  hello: { fontSize: 28, fontWeight: "800", color: colors.textPrimary },
  helloSub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },

  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  actionItem: { flex: 1 },
  actionCard: { gap: 8, paddingVertical: 18 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  actionDesc: { fontSize: 12, color: colors.textMuted },

  loading: { paddingVertical: 50, alignItems: "center" },

  section: { marginTop: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  sectionCount: {
    fontSize: 12, fontWeight: "600", color: colors.textMuted,
    backgroundColor: colors.bgCardInset, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1,
    overflow: "hidden",
  },

  emptyCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  emptyCardText: { fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
  emptyCardTextMuted: { fontSize: 14, color: colors.textMuted },

  interestCard: { gap: 8 },
  interestTopic: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: colors.bgCardInset, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 12, color: colors.textSecondary },

  paperCard: { flexDirection: "row", alignItems: "center", gap: 10 },
  paperTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, lineHeight: 20 },
  paperMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
