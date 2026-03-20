import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../lib/client";
import type { ChatMessage } from "@research-copilot/types";

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

export default function CopilotScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const listRef = useRef<FlatList<ChatMessage>>(null);

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
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "请求失败，请检查网络连接。" }
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
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Copilot</Text>
          <Text style={styles.subtitle}>AI 科研助手</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={handleNewChat}>
          <Ionicons name="add" size={22} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="sparkles" size={36} color="#007AFF" />
            </View>
            <Text style={styles.welcomeTitle}>智研 Copilot</Text>
            <Text style={styles.welcomeText}>
              你的 AI 科研助手，随时为你解答论文问题
            </Text>
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

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="输入问题…"
            placeholderTextColor="#8E8E93"
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: "#E8ECF0" },
  header:   {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title:    { fontSize: 28, fontWeight: "700", color: "#1C1C1E" },
  subtitle: { fontSize: 14, color: "#8E8E93", marginTop: 2 },
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E8ECF0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1C1C1E",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
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
    backgroundColor: "#E8ECF0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  welcomeTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  welcomeText:  { fontSize: 14, color: "#8E8E93", textAlign: "center", paddingHorizontal: 40 },

  messageList: { paddingHorizontal: 16, paddingVertical: 12 },
  messageItem: { marginBottom: 16 },
  bubbleRow:     { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#E8ECF0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.5)",
    flexShrink: 0,
  },
  avatarUser: {
    backgroundColor: "#007AFF",
    borderColor: "rgba(0,98,204,0.3)",
  },
  bubble:          { maxWidth: "75%", borderRadius: 18, padding: 12 },
  bubbleAssistant: {
    backgroundColor: "#F2F6FA",
    shadowColor: "#1C1C1E",
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
  bubbleText:     { fontSize: 15, lineHeight: 22, color: "#1C1C1E" },
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
    backgroundColor: "#E8ECF0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1C1C1E",
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.5)",
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
});
