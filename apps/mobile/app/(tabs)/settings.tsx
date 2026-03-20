import { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { getApiBaseUrl, setApiBaseUrl } from "../../lib/client";

type SectionRow = {
  label: string;
  value: string;
};

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

  const handleSave = async () => {
    await setApiBaseUrl(apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>设置</Text>
          <Text style={styles.subtitle}>配置应用偏好</Text>
        </View>

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
            placeholderTextColor="#8E8E93"
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

        {/* About */}
        <NmCard style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "rgba(175,82,222,0.12)" }]}>
              <Ionicons name="information-circle-outline" size={18} color="#AF52DE" />
            </View>
            <Text style={styles.sectionTitle}>关于</Text>
          </View>

          <InfoRow label="应用名称" value="智研 Copilot" />
          <View style={styles.divider} />
          <InfoRow label="版本" value="0.1.4 (4)" />
          <View style={styles.divider} />
          <InfoRow label="平台" value="Expo SDK 52 · React Native" />
          <View style={styles.divider} />
          <InfoRow label="后端" value="FastAPI · PostgreSQL · pgvector · Multi-Agent" />
        </NmCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#E8ECF0" },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  header:  { paddingTop: 16 },
  title:   { fontSize: 28, fontWeight: "700", color: "#1C1C1E" },
  subtitle:{ fontSize: 14, color: "#8E8E93", marginTop: 2 },

  card: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "rgba(0,122,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },

  inputLabel: { fontSize: 12, fontWeight: "500", color: "#8E8E93", marginLeft: 4 },
  input: {
    backgroundColor: "#E8ECF0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.5)",
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
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  saveBtnSuccess: { backgroundColor: "#34C759" },
  saveBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

  infoRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  infoLabel:{ fontSize: 14, color: "#8E8E93" },
  infoValue:{ fontSize: 14, fontWeight: "500", color: "#3C3C43" },
  divider:  { height: 1, backgroundColor: "rgba(200,205,211,0.4)", marginVertical: 6 },
});
