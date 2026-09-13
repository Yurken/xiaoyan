import { colors } from "../theme";
import { View, Text, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ChatMessage } from "@research-copilot/types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={16} color={colors.accent} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        {isUser && message.images?.map((img, index) => (
          <Image
            key={`${img.name ?? "img"}-${index}`}
            source={{ uri: `data:${img.mediaType};base64,${img.data}` }}
            style={styles.bubbleImage}
            resizeMode="cover"
          />
        ))}
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content || "…"}
        </Text>
      </View>
      {isUser && (
        <View style={[styles.avatar, styles.avatarUser]}>
          <Ionicons name="person" size={16} color={colors.highlight} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  avatarUser: {
    backgroundColor: colors.accent,
    borderColor: colors.accentBorder,
  },
  bubble: { maxWidth: "75%", borderRadius: 18, padding: 12 },
  bubbleAssistant: {
    backgroundColor: colors.bgCardInset,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: colors.highlightBorder,
  },
  bubbleUser: {
    backgroundColor: colors.accent,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  bubbleTextUser: { color: colors.highlight },
  bubbleImage: { width: 180, height: 135, borderRadius: 12, marginBottom: 6 },
});
