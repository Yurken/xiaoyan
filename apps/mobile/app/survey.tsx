import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ScreenHeader";
import { NmCard } from "../components/NmCard";
import { NmInput } from "../components/NmInput";
import { NmButton } from "../components/NmButton";
import { SurveyResult } from "../features/survey/SurveyResult";
import { useSurvey } from "../features/survey/useSurvey";
import { colors } from "../features/theme";

export default function SurveyScreen() {
  const [query, setQuery] = useState("");
  const { loading, result, error, generate } = useSurvey();

  const onGenerate = () => {
    Keyboard.dismiss();
    generate(query);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScreenHeader
        title="文献综述"
        subtitle="输入研究关键词，小妍检索相关文献并整理成结构化综述"
        backLabel="工作台"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <NmCard style={styles.formCard}>
          <NmInput
            label="研究关键词"
            placeholder="例如：graph neural network for drug discovery"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={onGenerate}
          />
          <NmButton size="lg" loading={loading} disabled={!query.trim()} onPress={onGenerate}>
            {loading ? "正在生成…" : "生成综述"}
          </NmButton>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </NmCard>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>小妍正在检索并撰写综述…</Text>
            <Text style={styles.loadingHint}>检索文献、提炼方法与趋势，可能需要数十秒</Text>
          </View>
        ) : result ? (
          <SurveyResult data={result} />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.placeholderIcon}>
              <Ionicons name="library-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.placeholderText}>输入关键词，生成文献综述</Text>
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
