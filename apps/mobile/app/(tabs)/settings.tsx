import { useState, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { MAIN_ASSISTANT_NAME, PRODUCT_NAME } from "@research-copilot/types";
import { NmCard } from "../../components/NmCard";
import { getApiBaseUrl, setApiBaseUrl } from "../../lib/client";
import { useWebdavSync } from "../../features/webdav/useWebdavSync";
import { useSync } from "../../features/sync/useSync";

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
  const [apiUrl, setApiUrlState] = useState(getApiBaseUrl());
  const [saved, setSaved] = useState(false);

  // WebDAV 同步：配置由 useSync 持久化（密码即同步加密密钥）
  const { config, setField, syncing, summary, error: syncError, lastSyncedAt, runSync } = useSync();
  const { testing, testConnection, message: webdavMsg, setMessage: setWebdavMsg } = useWebdavSync();

  const handleSave = async () => {
    await setApiBaseUrl(apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleWebdavTest = useCallback(async () => {
    if (!config.url.trim()) return;
    setWebdavMsg(null);
    await testConnection({ url: config.url.trim(), username: config.username, password: config.password });
  }, [config, testConnection, setWebdavMsg]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>设置</Text>
          <Text style={styles.subtitle}>管理应用连接与基础信息</Text>
        </View>

        {/* Account */}
        <NmCard style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="person-circle-outline" size={18} color="#007AFF" />
            </View>
            <Text style={styles.sectionTitle}>账号</Text>
          </View>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.loginBtnText}>登录 / 注册</Text>
          </TouchableOpacity>
          <Text style={styles.loginHint}>登录后可同步聊天记录与论文分析结果</Text>
        </NmCard>

        {/* Backend */}
        <NmCard style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="server-outline" size={18} color="#007AFF" />
            </View>
            <Text style={styles.sectionTitle}>后端连接</Text>
          </View>
          <Text style={styles.inputLabel}>API 地址</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrlState}
            placeholder="http://localhost:8008"
            placeholderTextColor="#5F6B7A"
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnSuccess]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            {saved && <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />}
            <Text style={styles.saveBtnText}>{saved ? "已保存" : "保存"}</Text>
          </TouchableOpacity>
        </NmCard>

        {/* WebDAV Sync */}
        <NmCard style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "rgba(10,132,255,0.1)" }]}>
              <Ionicons name="cloud-outline" size={18} color="#0A84FF" />
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
            placeholderTextColor="#5F6B7A"
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
                placeholderTextColor="#5F6B7A"
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
                placeholderTextColor="#5F6B7A"
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.webdavRow}>
            <TouchableOpacity
              style={[styles.saveBtn, styles.webdavBtnFlex, { backgroundColor: "#1C2530" }]}
              onPress={handleWebdavTest}
              disabled={testing || !config.url.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="link-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>{testing ? "测试中…" : "测试连接"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, styles.webdavBtnFlex, { backgroundColor: "#0A84FF" }]}
              onPress={() => void runSync()}
              disabled={syncing || !config.url.trim() || !config.password}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>{syncing ? "同步中…" : "立即同步"}</Text>
            </TouchableOpacity>
          </View>

          {webdavMsg ? (
            <Text style={[styles.webdavMsg, webdavMsg.includes("失败") ? { color: "#FF3B30" } : { color: "#34C759" }]}>
              {webdavMsg}
            </Text>
          ) : null}
          {syncError ? <Text style={[styles.webdavMsg, { color: "#FF3B30" }]}>{syncError}</Text> : null}
          {summary ? (
            <Text style={[styles.webdavMsg, { color: "#34C759" }]}>
              已同步 {summary.devices} 台设备 · 更新 {summary.applied} 条 · 删除 {summary.deleted} 条
            </Text>
          ) : null}
          {lastSyncedAt ? (
            <Text style={styles.webdavMsg}>上次同步：{new Date(lastSyncedAt).toLocaleString("zh-CN")}</Text>
          ) : null}
        </NmCard>

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
          <InfoRow label="版本" value="0.4.0" />
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
  sectionHint: { fontSize: 12, color: "#5F6B7A" },

  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: "#0062CC",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  loginBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  loginHint: { fontSize: 12, color: "#5F6B7A", textAlign: "center" },

  inputLabel: { fontSize: 12, fontWeight: "500", color: "#5F6B7A", marginLeft: 4 },
  input: {
    backgroundColor: "#0F141C",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#F5F7FA",
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.5)",
  },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: "#0062CC",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  saveBtnSuccess: { backgroundColor: "#34C759" },
  saveBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

  webdavRow: { flexDirection: "row", gap: 10 },
  webdavHalf: { flex: 1, gap: 6 },
  webdavBtnFlex: { flex: 1 },
  webdavMsg: { fontSize: 12, fontWeight: "500", textAlign: "center", marginTop: 4, color: "#9AA7B8" },

  infoRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  infoLabel:{ fontSize: 14, color: "#5F6B7A" },
  infoValue:{ fontSize: 14, fontWeight: "500", color: "#9AA7B8" },
  divider:  { height: 1, backgroundColor: "rgba(60,74,92,0.4)", marginVertical: 6 },
});
