import { colors } from "../theme";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ChatSession } from "@research-copilot/types";

export function ChatSessionItem({
  session,
  isActive,
  onPress,
}: {
  session: ChatSession;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.sessionItem, isActive && styles.sessionItemActive]}
      activeOpacity={0.65}
      onPress={onPress}
    >
      <View style={styles.sessionIcon}>
        <Ionicons
          name="chatbubble-ellipses"
          size={14}
          color={isActive ? colors.accent : colors.textMuted}
        />
      </View>
      <View style={styles.sessionInfo}>
        <Text style={[styles.sessionTitle, isActive && styles.sessionTitleActive]} numberOfLines={1}>
          {session.title || "新对话"}
        </Text>
        <Text style={styles.sessionDate}>
          {new Date(session.updated_at || session.created_at).toLocaleDateString("zh-CN")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sessionItemActive: {
    borderColor: colors.accentBorder,
  },
  sessionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  sessionTitleActive: { color: colors.accent },
  sessionDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
