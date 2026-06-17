import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "../features/theme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  backLabel?: string;
}

export function ScreenHeader({ title, subtitle, backLabel = "返回" }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={colors.accent} />
        <Text style={styles.backText}>{backLabel}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 10, marginLeft: -4 },
  backText: { fontSize: 16, color: colors.accent, fontWeight: "500" },
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 3, lineHeight: 19 },
});
