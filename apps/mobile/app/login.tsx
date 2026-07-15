import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { MAIN_ASSISTANT_WELCOME_TITLE, PRODUCT_NAME } from "@research-copilot/types";
import { NmCard } from "../components/NmCard";
import { useAuth } from "../features/auth/useAuth";
import { getApiBaseUrl } from "../lib/client";

export default function LoginScreen() {
  const { login, register, loading, error } = useAuth();

  const [isRegister, setIsRegister] = useState(false);

  // Email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    const fn = isRegister ? register : login;
    const ok = await fn(email.trim(), password);
    if (ok) router.back();
  };

  const canSubmit = Boolean(email.trim() && password.trim());

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Close */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color="#5F6B7A" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.brandIcon}>
              <Ionicons name="sparkles" size={32} color="#007AFF" />
            </View>
            <Text style={styles.brandName}>{PRODUCT_NAME}</Text>
            <Text style={styles.brandDesc}>{MAIN_ASSISTANT_WELCOME_TITLE}</Text>
          </View>

          {/* Form */}
          <NmCard style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>邮箱</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#5F6B7A"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>密码</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#5F6B7A"
                  secureTextEntry={!showPassword}
                  autoComplete={isRegister ? "new-password" : "password"}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#5F6B7A"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, (!canSubmit || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isRegister ? "注册" : "登录"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle */}
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => setIsRegister((v) => !v)}
            >
              <Text style={styles.switchText}>
                {isRegister ? "已有账号？使用邮箱登录" : "没有账号？使用邮箱注册"}
              </Text>
            </TouchableOpacity>
          </NmCard>

          {/* Server info */}
          <Text style={styles.serverInfo}>连接到 {getApiBaseUrl()}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: "#090B10" },
  keyboard: { flex: 1 },

  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 12,
    backgroundColor: "#141A23",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.7)",
  },

  body: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 22 },

  brand: { alignItems: "center", gap: 8 },
  brandIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: "#141A23",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  brandName: { fontSize: 20, fontWeight: "700", color: "#F5F7FA" },
  brandDesc:  { fontSize: 13, color: "#5F6B7A" },

  // Form
  formCard: { padding: 20, gap: 16 },

  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: "500", color: "#5F6B7A", marginLeft: 4 },
  input: {
    backgroundColor: "#0F141C",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#F5F7FA",
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.5)",
  },

  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute",
    right: 12, top: 0, bottom: 0,
    justifyContent: "center",
  },

  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { fontSize: 13, color: "#FF3B30" },

  submitBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#0062CC",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  switchBtn: { alignItems: "center", paddingVertical: 4 },
  switchText: { fontSize: 14, color: "#007AFF" },

  serverInfo: { fontSize: 12, color: "#5F6B7A", textAlign: "center" },
});
