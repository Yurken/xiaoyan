import { colors } from "../../features/theme";
import { useRef, useEffect } from "react";
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  MAIN_ASSISTANT_INPUT_PLACEHOLDER,
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_ROLE,
  MAIN_ASSISTANT_WELCOME_DESCRIPTION,
  MAIN_ASSISTANT_WELCOME_TITLE,
} from "@research-copilot/types";
import type { ChatMessage, ChatSession } from "@research-copilot/types";
import { MessageBubble } from "../../features/chat/MessageBubble";
import { ChatSessionItem } from "../../features/chat/ChatSessionItem";
import { useChat } from "../../features/chat/useChat";

export default function XiaoYanScreen() {
  const {
    messages, input, sending, sessionId, loadingSession, showSessions,
    sessionError, sessions, sessionsSource, sessionsError,
    setInput, send, newChat, loadSession, toggleSessions,
  } = useChat();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{MAIN_ASSISTANT_NAME}</Text>
          <Text style={styles.subtitle}>{MAIN_ASSISTANT_ROLE}</Text>
        </View>
        <View style={styles.headerActions}>
          {sessions.length > 0 && (
            <TouchableOpacity
              style={[styles.headerBtn, showSessions && styles.headerBtnActive]}
              onPress={toggleSessions}
            >
              <Ionicons name="time-outline" size={20} color={showSessions ? colors.accent : colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={newChat}>
            <Ionicons name="add" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {sessionsSource === "synced" ? (
        <View style={styles.syncedBanner}>
          <Text style={styles.syncedText}>正在浏览 WebDAV 同步对话 · 只读历史</Text>
        </View>
      ) : null}
      {sessionsSource === "unavailable" && sessionsError ? (
        <View style={styles.unavailableBanner}>
          <Text style={styles.unavailableText}>{sessionsError}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {loadingSession ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : messages.length === 0 && !showSessions ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="sparkles" size={36} color={colors.accent} />
            </View>
            <Text style={styles.welcomeTitle}>{MAIN_ASSISTANT_WELCOME_TITLE}</Text>
            <Text style={styles.welcomeText}>{MAIN_ASSISTANT_WELCOME_DESCRIPTION}</Text>
            {sessions.length > 0 && (
              <TouchableOpacity style={styles.historyBtn} onPress={toggleSessions}>
                <Ionicons name="time-outline" size={16} color={colors.accent} />
                <Text style={styles.historyBtnText}>查看历史对话 ({sessions.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : showSessions ? (
          <View style={styles.sessionList}>
            <Text style={styles.sessionListTitle}>历史对话</Text>
            {sessionError ? <Text style={styles.sessionError}>{sessionError}</Text> : null}
            <FlatList<ChatSession>
              data={sessions}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <ChatSessionItem
                  session={item}
                  isActive={item.id === sessionId}
                  onPress={() => { void loadSession(item.id); }}
                />
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>暂无历史对话</Text>}
            />
          </View>
        ) : (
          <View style={styles.messageList}>
            <FlatList<ChatMessage>
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }: { item: ChatMessage }) => (
                <View style={styles.messageItem}>
                  <MessageBubble message={item} />
                </View>
              )}
            />
          </View>
        )}

        {!showSessions && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder={MAIN_ASSISTANT_INPUT_PLACEHOLDER}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              returnKeyType="send"
              onSubmitEditing={() => { void send(); }}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => { void send(); }}
              disabled={!input.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={colors.highlight} />
                : <Ionicons name="arrow-up" size={20} color={colors.highlight} />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  headerBtnActive: { borderColor: colors.accentBorder },
  syncedBanner: {
    marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.accentSoft,
  },
  syncedText: { fontSize: 13, color: colors.accentStrong, fontWeight: "500" },
  unavailableBanner: {
    marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.warningSoft,
  },
  unavailableText: { fontSize: 13, color: colors.warning, fontWeight: "500" },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 80 },
  welcomeIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.accent, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8,
    borderWidth: 1, borderColor: colors.highlightBorder,
  },
  welcomeTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  welcomeText: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingHorizontal: 40 },
  historyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.accentSubtle,
  },
  historyBtnText: { fontSize: 14, color: colors.accent, fontWeight: "500" },
  sessionList: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  sessionListTitle: { fontSize: 15, fontWeight: "600", color: colors.textMuted, marginBottom: 12, paddingHorizontal: 4 },
  sessionError: { fontSize: 13, color: colors.danger, marginBottom: 12, paddingHorizontal: 4 },
  messageList: { paddingHorizontal: 16, paddingVertical: 12 },
  messageItem: { marginBottom: 16 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  textInput: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.textPrimary,
    maxHeight: 120, borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.accentStrong, shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6,
  },
  sendBtnDisabled: { opacity: 0.4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingTop: 24 },
});
