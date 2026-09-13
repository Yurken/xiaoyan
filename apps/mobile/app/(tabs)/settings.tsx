import { colors } from "../../features/theme";
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
            <View style={[styles.sectionIcon, { backgroundColor: colors.purpleSoft }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.purple} />
            </View>
            <Text style={styles.sectionTitle}>关于</Text>
          </View>

          <InfoRow label="应用名称" value={PRODUCT_NAME} />
          <View style={styles.divider} />
          <InfoRow label="主 AI" value={MAIN_ASSISTANT_NAME} />
          <View style={styles.divider} />
          <InfoRow label="版本" value="0.6.0-dev.1" />
          <View style={styles.divider} />
          <InfoRow label="平台" value="Expo SDK 54 · React Native" />
          <View style={styles.divider} />
          <InfoRow label="数据" value="本地存储 · WebDAV 同步" />
        </NmCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  header:  { paddingTop: 16 },
  title:   { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  subtitle:{ fontSize: 14, color: colors.textMuted, marginTop: 2 },

  card: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.accentSubtle,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },

  infoRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  infoLabel:{ fontSize: 14, color: colors.textMuted },
  infoValue:{ fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  divider:  { height: 1, backgroundColor: colors.borderLight, marginVertical: 6 },
});
