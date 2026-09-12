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
          color={isActive ? "#007AFF" : "#5F6B7A"}
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
    backgroundColor: "#141A23",
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.35)",
  },
  sessionItemActive: {
    borderColor: "rgba(0,122,255,0.4)",
  },
  sessionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(0,122,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 14, fontWeight: "500", color: "#9AA7B8" },
  sessionTitleActive: { color: "#007AFF" },
  sessionDate: { fontSize: 12, color: "#5F6B7A", marginTop: 2 },
});
