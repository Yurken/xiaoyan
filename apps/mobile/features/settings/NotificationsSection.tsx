import { colors } from "../theme";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { useNotifications } from "../notifications/useNotifications";

const STATUS_COPY: Record<string, string> = {
  granted: "已授权，可接收本地通知",
  denied: "系统已拒绝通知，请到系统设置中开启",
  undetermined: "尚未授权，点击下方按钮以启用",
};

export function NotificationsSection() {
  const { permissionStatus, loading, message, enable, sendTest } = useNotifications();
  const granted = permissionStatus === "granted";
  const denied = permissionStatus === "denied";
  const statusText = permissionStatus
    ? STATUS_COPY[permissionStatus] ?? "通知权限状态未知"
    : loading
      ? "正在读取通知权限…"
      : "尚未读取通知权限";

  return (
    <NmCard style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="notifications-outline" size={18} color={colors.warning} />
        </View>
        <Text style={styles.sectionTitle}>通知</Text>
      </View>

      <Text style={[styles.statusText, granted && styles.statusGranted, denied && styles.statusDenied]}>
        {statusText}
      </Text>
      <Text style={styles.hint}>
        当前仅支持本地测试通知；后台任务完成提醒需要后端推送服务。
      </Text>

      {denied ? (
        <Text style={styles.hint}>请在系统设置中允许本应用发送通知后再试。</Text>
      ) : null}

      {granted ? (
        <TouchableOpacity
          style={[styles.actionBtn, loading && styles.btnDisabled]}
          onPress={() => void sendTest()}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="paper-plane-outline" size={16} color={colors.highlight} style={styles.btnIcon} />
          <Text style={styles.actionBtnText}>发送测试通知</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.actionBtn, loading && styles.btnDisabled]}
          onPress={() => void enable()}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={16} color={colors.highlight} style={styles.btnIcon} />
          <Text style={styles.actionBtnText}>启用通知</Text>
        </TouchableOpacity>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </NmCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  statusText: { fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  statusGranted: { color: colors.success },
  statusDenied: { color: colors.warning },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
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
  btnDisabled: { opacity: 0.55 },
  btnIcon: { marginRight: 6 },
  actionBtnText: { color: colors.highlight, fontSize: 15, fontWeight: "600" },
  message: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
});
