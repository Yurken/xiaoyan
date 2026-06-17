import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ScreenHeader";
import { NmCard } from "../components/NmCard";
import { NmInput } from "../components/NmInput";
import { NmButton } from "../components/NmButton";
import { PlannerResult } from "../features/planner/PlannerResult";
import { usePlanner } from "../features/planner/usePlanner";
import { colors } from "../features/theme";

export default function PlannerScreen() {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const { loading, result, error, generate } = usePlanner();

  const onGenerate = () => {
    Keyboard.dismiss();
    generate(topic, keywords);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScreenHeader
        title="研究规划"
        subtitle="告诉小妍你的研究方向，她帮你梳理学习路径和先修知识"
        backLabel="工作台"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <NmCard style={styles.formCard}>
          <NmInput
            label="研究方向"
            placeholder="例如：大语言模型的对齐技术"
            value={topic}
            onChangeText={setTopic}
            returnKeyType="next"
          />
          <NmInput
            label="关键词（可选，逗号分隔）"
            placeholder="例如：RLHF, PPO, reward model"
            value={keywords}
            onChangeText={setKeywords}
          />
          <NmButton size="lg" loading={loading} disabled={!topic.trim()} onPress={onGenerate}>
            {loading ? "正在生成…" : "生成学习路径"}
          </NmButton>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </NmCard>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>小妍正在为你规划学习路径…</Text>
            <Text style={styles.loadingHint}>检索经典文献并拆解学习阶段，约需十几秒</Text>
          </View>
        ) : result ? (
          <PlannerResult path={result} />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.placeholderIcon}>
              <Ionicons name="map-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.placeholderText}>输入研究方向，开始规划</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  formCard: { gap: 14 },
  error: { fontSize: 13, color: colors.danger },

  loadingBox: { alignItems: "center", gap: 8, paddingVertical: 40 },
  loadingText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, marginTop: 6 },
  loadingHint: { fontSize: 13, color: colors.textMuted },

  placeholder: { alignItems: "center", gap: 14, paddingVertical: 56 },
  placeholderIcon: {
    width: 76, height: 76, borderRadius: 26, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderLight,
  },
  placeholderText: { fontSize: 15, color: colors.textMuted },
});
