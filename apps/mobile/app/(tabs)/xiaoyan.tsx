import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform,
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
import { apiClient } from "../../lib/client";
import { useChatSessions } from "../../features/chat/useChatSessions";
import type { ChatMessage, ChatSession } from "@research-copilot/types";

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={16} color="#007AFF" />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content || "…"}
        </Text>
      </View>
      {isUser && (
        <View style={[styles.avatar, styles.avatarUser]}>
          <Ionicons name="person" size={16} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

function SessionItem({
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

export default function XiaoYanScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loadingSession, setLoadingSession] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { sessions, reload: reloadSessions } = useChatSessions();

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantId = `${Date.now()}_a`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let newSessionId = sessionId;
      for await (const chunk of apiClient.chat.stream({
        session_id: sessionId,
        message: text,
      })) {
        if (chunk.type === "session_id") {
          newSessionId = chunk.value;
          setSessionId(chunk.value);
        } else if (chunk.type === "delta") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + chunk.value }
                : m
            )
          );
        }
      }
      reloadSessions();
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "请求未完成，请检查网络连接后重试。" }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setShowSessions(false);
  };

  const handleLoadSession = async (id: string) => {
    if (id === sessionId) {
      setShowSessions(false);
      return;
    }
    setLoadingSession(true);
    setShowSessions(false);
    try {
      const data = await apiClient.chat.getSession(id);
      setMessages(data.messages ?? []);
      setSessionId(id);
    } catch {
      // Silently fail; session might not be loadable
    } finally {
      setLoadingSession(false);
    }
  };

  const toggleSessions = () => {
    setShowSessions((v) => !v);
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
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
              <Ionicons name="time-outline" size={20} color={showSessions ? "#007AFF" : "#5F6B7A"} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={handleNewChat}>
            <Ionicons name="add" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {loadingSession ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : messages.length === 0 && !showSessions ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="sparkles" size={36} color="#007AFF" />
            </View>
            <Text style={styles.welcomeTitle}>{MAIN_ASSISTANT_WELCOME_TITLE}</Text>
            <Text style={styles.welcomeText}>{MAIN_ASSISTANT_WELCOME_DESCRIPTION}</Text>

            {sessions.length > 0 && (
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={toggleSessions}
              >
                <Ionicons name="time-outline" size={16} color="#007AFF" />
                <Text style={styles.historyBtnText}>
                  查看历史对话 ({sessions.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : showSessions ? (
          /* Session List */
          <View style={styles.sessionList}>
            <Text style={styles.sessionListTitle}>历史对话</Text>
            <FlatList<ChatSession>
              data={sessions}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <SessionItem
                  session={item}
                  isActive={item.id === sessionId}
                  onPress={() => handleLoadSession(item.id)}
                />
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>暂无历史对话</Text>
              }
            />
          </View>
        ) : (
          /* Messages */
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

        {/* Input Bar */}
        {!showSessions && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder={MAIN_ASSISTANT_INPUT_PLACEHOLDER}
              placeholderTextColor="#5F6B7A"
              multiline
              maxLength={2000}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: "#090B10" },
  header:   {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title:    { fontSize: 28, fontWeight: "700", color: "#F5F7FA" },
  subtitle: { fontSize: 14, color: "#5F6B7A", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#141A23",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.7)",
  },
  headerBtnActive: {
    borderColor: "rgba(0,122,255,0.4)",
  },

  welcome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingBottom: 80,
  },
  welcomeIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#141A23",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  welcomeTitle: { fontSize: 20, fontWeight: "700", color: "#F5F7FA" },
  welcomeText:  { fontSize: 14, color: "#5F6B7A", textAlign: "center", paddingHorizontal: 40 },

  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,122,255,0.1)",
  },
  historyBtnText: { fontSize: 14, color: "#007AFF", fontWeight: "500" },

  sessionList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sessionListTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5F6B7A",
    marginBottom: 12,
    paddingHorizontal: 4,
  },

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

  messageList: { paddingHorizontal: 16, paddingVertical: 12 },
  messageItem: { marginBottom: 16 },
  bubbleRow:     { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#141A23",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.5)",
    flexShrink: 0,
  },
  avatarUser: {
    backgroundColor: "#007AFF",
    borderColor: "rgba(0,98,204,0.3)",
  },
  bubble:          { maxWidth: "75%", borderRadius: 18, padding: 12 },
  bubbleAssistant: {
    backgroundColor: "#1E2A3A",
    shadowColor: "#F5F7FA",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  bubbleUser: {
    backgroundColor: "#007AFF",
    shadowColor: "#0062CC",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  bubbleText:     { fontSize: 15, lineHeight: 22, color: "#F5F7FA" },
  bubbleTextUser: { color: "#FFFFFF" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#0F141C",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#F5F7FA",
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.5)",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0062CC",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  sendBtnDisabled: { opacity: 0.4 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, color: "#5F6B7A", textAlign: "center", paddingTop: 24 },
});
