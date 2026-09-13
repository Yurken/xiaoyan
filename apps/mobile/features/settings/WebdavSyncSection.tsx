import { colors } from "../theme";
import { useCallback } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { useWebdavSync } from "../webdav/useWebdavSync";
import { useSync } from "../sync/useSync";

export function WebdavSyncSection() {
  // WebDAV 同步：配置由 useSync 持久化（密码即同步加密密钥）
  const { config, setField, syncing, summary, error: syncError, lastSyncedAt, runSync } = useSync();
  const { testing, testConnection, message: webdavMsg, setMessage: setWebdavMsg } = useWebdavSync();

  const handleWebdavTest = useCallback(async () => {
    if (!config.url.trim()) return;
    setWebdavMsg(null);
    await testConnection({ url: config.url.trim(), username: config.username, password: config.password });
  }, [config, testConnection, setWebdavMsg]);

  return (
    <NmCard style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.accentSubtle }]}>
          <Ionicons name="cloud-outline" size={18} color={colors.accent} />
        </View>
        <Text style={styles.sectionTitle}>WebDAV 同步</Text>
      </View>
      <Text style={styles.sectionHint}>连接到自建 WebDAV 服务，从桌面端同步论文、研究方向、综述等数据到本机</Text>

      <Text style={styles.inputLabel}>服务器地址</Text>
      <TextInput
        style={styles.input}
        value={config.url}
        onChangeText={(v) => setField("url", v)}
        placeholder="https://dav.example.com/remote.php/dav/files/user/"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="url"
      />

      <View style={styles.webdavRow}>
        <View style={styles.webdavHalf}>
          <Text style={styles.inputLabel}>用户名</Text>
          <TextInput
            style={styles.input}
            value={config.username}
            onChangeText={(v) => setField("username", v)}
            placeholder="用户名"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.webdavHalf}>
          <Text style={styles.inputLabel}>密码</Text>
          <TextInput
            style={styles.input}
            value={config.password}
            onChangeText={(v) => setField("password", v)}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.webdavRow}>
        <TouchableOpacity
          style={[styles.saveBtn, styles.webdavBtnFlex, { backgroundColor: colors.bgCardInset }]}
          onPress={handleWebdavTest}
          disabled={testing || !config.url.trim()}
          activeOpacity={0.8}
        >
          <Ionicons name="link-outline" size={16} color={colors.highlight} style={{ marginRight: 6 }} />
          <Text style={styles.saveBtnText}>{testing ? "测试中…" : "测试连接"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, styles.webdavBtnFlex, { backgroundColor: colors.accent }]}
          onPress={() => void runSync()}
          disabled={syncing || !config.url.trim() || !config.password}
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-download-outline" size={16} color={colors.highlight} style={{ marginRight: 6 }} />
          <Text style={styles.saveBtnText}>{syncing ? "同步中…" : "立即同步"}</Text>
        </TouchableOpacity>
      </View>

      {webdavMsg ? (
        <Text style={[styles.webdavMsg, webdavMsg.includes("失败") ? { color: colors.danger } : { color: colors.success }]}>
          {webdavMsg}
        </Text>
      ) : null}
      {syncError ? <Text style={[styles.webdavMsg, { color: colors.danger }]}>{syncError}</Text> : null}
      {summary ? (
        <Text style={[styles.webdavMsg, { color: colors.success }]}>
          已同步 {summary.devices} 台设备 · 更新 {summary.applied} 条 · 删除 {summary.deleted} 条
        </Text>
      ) : null}
      {lastSyncedAt ? (
        <Text style={styles.webdavMsg}>上次同步：{new Date(lastSyncedAt).toLocaleString("zh-CN")}</Text>
      ) : null}
    </NmCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.accentSubtle,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  sectionHint: { fontSize: 12, color: colors.textMuted },

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

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  saveBtnText: { color: colors.highlight, fontSize: 15, fontWeight: "600" },

  webdavRow: { flexDirection: "row", gap: 10 },
  webdavHalf: { flex: 1, gap: 6 },
  webdavBtnFlex: { flex: 1 },
  webdavMsg: { fontSize: 12, fontWeight: "500", textAlign: "center", marginTop: 4, color: colors.textSecondary },
});
