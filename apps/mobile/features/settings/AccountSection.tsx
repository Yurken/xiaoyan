import { colors } from "../theme";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { NmCard } from "../../components/NmCard";
import { useAuth } from "../auth/useAuth";

export function AccountSection() {
  const { authenticated, loading, error, logout } = useAuth();

  return (
    <NmCard style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="person-circle-outline" size={18} color={colors.accent} />
        </View>
        <Text style={styles.sectionTitle}>账号</Text>
      </View>

      {authenticated ? (
        <>
          <Text style={styles.statusText}>已登录</Text>
          <TouchableOpacity
            style={[styles.actionBtn, styles.logoutBtn, loading && styles.btnDisabled]}
            onPress={() => void logout()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons
              name={loading ? "sync-outline" : "log-out-outline"}
              size={18}
              color={colors.highlight}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.actionBtnText}>{loading ? "处理中" : "退出登录"}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={18} color={colors.highlight} style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>登录 / 注册</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>登录后可使用需要认证的后端能力</Text>
        </>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </NmCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accentSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  statusText: { fontSize: 14, fontWeight: "500", color: colors.success },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  logoutBtn: { backgroundColor: colors.danger, shadowColor: colors.dangerStrong },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: colors.highlight, fontSize: 15, fontWeight: "600" },
  errorText: { fontSize: 12, color: colors.danger, textAlign: "center" },
});
