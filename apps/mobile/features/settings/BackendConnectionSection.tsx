import { colors } from "../theme";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import {
  useApiConnection,
  type ApiConnectionStatus,
} from "../connectivity/useApiConnection";

const STATUS_COPY: Record<ApiConnectionStatus, string> = {
  idle: "尚未检测连接",
  connected: "已连接后端",
  auth_required: "需要登录认证",
  incompatible: "接口不兼容或地址无效",
  timeout: "连接超时",
  network: "网络不可达",
};

const STATUS_COLOR: Record<ApiConnectionStatus, string> = {
  idle: colors.textSecondary,
  connected: colors.success,
  auth_required: colors.accent,
  incompatible: colors.danger,
  timeout: colors.warning,
  network: colors.danger,
};

const STATUS_ICON: Record<ApiConnectionStatus, keyof typeof Ionicons.glyphMap> = {
  idle: "ellipse-outline",
  connected: "checkmark-circle",
  auth_required: "lock-closed",
  incompatible: "warning",
  timeout: "time-outline",
  network: "cloud-offline-outline",
};

export function BackendConnectionSection() {
  const { input, setInput, checking, status, message, savedUrl, saveAndProbe } =
    useApiConnection();

  const statusColor = STATUS_COLOR[status];
  const hint = Platform.OS === "android"
    ? "Android 模拟器请使用 10.0.2.2；真机请填写运行后端电脑的局域网地址和 8000 端口。"
    : "真机请填写运行后端电脑的局域网地址和 8000 端口。";

  return (
    <NmCard style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="server-outline" size={18} color={colors.accent} />
        </View>
        <Text style={styles.sectionTitle}>后端连接</Text>
      </View>

      <Text style={styles.hint}>{hint}</Text>
      <Text style={styles.hint}>更换后端地址后需要重新登录。</Text>

      <Text style={styles.inputLabel}>API 地址</Text>
      <TextInput
        style={[styles.input, checking && styles.inputDisabled]}
        value={input}
        onChangeText={setInput}
        placeholder="http://10.0.2.2:8000"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!checking}
      />

      <Text style={styles.savedUrl} numberOfLines={1}>
        当前已保存：{savedUrl || "未保存"}
      </Text>

      <TouchableOpacity
        style={[styles.saveBtn, checking && styles.saveBtnDisabled]}
        onPress={() => void saveAndProbe()}
        disabled={checking}
        activeOpacity={0.8}
      >
        <Ionicons
          name={checking ? "sync-outline" : "save-outline"}
          size={16}
          color={colors.highlight}
          style={styles.btnIcon}
        />
        <Text style={styles.saveBtnText}>{checking ? "检测中…" : "保存并检测"}</Text>
      </TouchableOpacity>

      <View style={styles.statusRow}>
        <Ionicons name={STATUS_ICON[status]} size={16} color={statusColor} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {STATUS_COPY[status]}
        </Text>
      </View>
      {message ? (
        <Text style={[styles.message, { color: statusColor }]}>{message}</Text>
      ) : null}
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
    backgroundColor: colors.accentSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  inputLabel: { fontSize: 12, fontWeight: "500", color: colors.textMuted, marginLeft: 4 },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputDisabled: { opacity: 0.55 },
  savedUrl: { fontSize: 12, color: colors.textSecondary },
  saveBtn: {
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
  saveBtnDisabled: { opacity: 0.55 },
  btnIcon: { marginRight: 6 },
  saveBtnText: { color: colors.highlight, fontSize: 15, fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { fontSize: 13, fontWeight: "600" },
  message: { fontSize: 12, lineHeight: 18 },
});
