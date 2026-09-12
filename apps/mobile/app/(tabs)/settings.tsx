import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MAIN_ASSISTANT_NAME, PRODUCT_NAME } from "@research-copilot/types";
import { NmCard } from "../../components/NmCard";
import { AccountSection } from "../../features/settings/AccountSection";
import { BackendConnectionSection } from "../../features/settings/BackendConnectionSection";
import { NotificationsSection } from "../../features/settings/NotificationsSection";
import { WebdavSyncSection } from "../../features/settings/WebdavSyncSection";

type SectionRow = { label: string; value: string };

function InfoRow({ label, value }: SectionRow) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>设置</Text>
          <Text style={styles.subtitle}>管理应用连接与基础信息</Text>
        </View>

        <AccountSection />

        <BackendConnectionSection />

        <NotificationsSection />

        <WebdavSyncSection />

        {/* About */}
        <NmCard style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "rgba(175,82,222,0.12)" }]}>
              <Ionicons name="information-circle-outline" size={18} color="#AF52DE" />
            </View>
            <Text style={styles.sectionTitle}>关于</Text>
          </View>

          <InfoRow label="应用名称" value={PRODUCT_NAME} />
          <View style={styles.divider} />
          <InfoRow label="主 AI" value={MAIN_ASSISTANT_NAME} />
          <View style={styles.divider} />
          <InfoRow label="版本" value="0.6.0-dev.1" />
          <View style={styles.divider} />
          <InfoRow label="平台" value="Expo SDK 52 · React Native" />
          <View style={styles.divider} />
          <InfoRow label="数据" value="本地存储 · WebDAV 同步" />
        </NmCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#090B10" },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  header:  { paddingTop: 16 },
  title:   { fontSize: 28, fontWeight: "700", color: "#F5F7FA" },
  subtitle:{ fontSize: 14, color: "#5F6B7A", marginTop: 2 },

  card: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "rgba(0,122,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#F5F7FA" },

  infoRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  infoLabel:{ fontSize: 14, color: "#5F6B7A" },
  infoValue:{ fontSize: 14, fontWeight: "500", color: "#9AA7B8" },
  divider:  { height: 1, backgroundColor: "rgba(60,74,92,0.4)", marginVertical: 6 },
});
