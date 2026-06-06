import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { NmCard } from "../../components/NmCard";
import { NmButton } from "../../components/NmButton";
import type { Paper } from "@research-copilot/types";

const STATUS_CONFIG = {
  analyzed:  { icon: "checkmark-circle" as const, color: "#34C759", label: "已分析" },
  analyzing: { icon: "hourglass"         as const, color: "#007AFF", label: "处理中" },
  failed:    { icon: "close-circle"      as const, color: "#FF3B30", label: "失败"   },
  pending:   { icon: "ellipse-outline"   as const, color: "#5F6B7A", label: "待分析" },
};

const CCF_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#FFE8E8", text: "#D93025" },
  B: { bg: "#FFF3E0", text: "#E65100" },
  C: { bg: "#F3F0FF", text: "#6741D9" },
};

function buildTags(paper: Paper) {
  const tags: Array<{ label: string; bg: string; text: string }> = [];
  if (paper.ccf_rating) {
    const c = CCF_COLORS[paper.ccf_rating] ?? { bg: "#E8F0FE", text: "#1A73E8" };
    tags.push({ label: `CCF ${paper.ccf_rating}`, bg: c.bg, text: c.text });
  }
  if (paper.wos_indexes) {
    for (const idx of paper.wos_indexes) {
      if (idx === "SCI" || idx === "SSCI" || idx === "EI") {
        tags.push({ label: idx, bg: "#E6F4EA", text: "#137333" });
      }
    }
  }
  if (paper.jcr_quartile) {
    tags.push({ label: paper.jcr_quartile, bg: "#EDE7F6", text: "#5E35B1" });
  }
  if (paper.cas_quartile) {
    tags.push({ label: `中科院${paper.cas_quartile}`, bg: "#E3F2FD", text: "#1565C0" });
  }
  if (paper.cas_top) {
    tags.push({ label: "顶刊", bg: "#FCE4EC", text: "#C62828" });
  }
  return tags;
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={18} color="#007AFF" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function AnalysisBlock({ label, content }: { label: string; content?: string }) {
  if (!content) return null;
  return (
    <View style={styles.analysisBlock}>
      <Text style={styles.analysisLabel}>{label}</Text>
      <Text style={styles.analysisContent}>{content}</Text>
    </View>
  );
}

export function PaperDetailView({
  paper,
  loading,
  error,
  onReload,
  onAnalyze,
}: {
  paper: Paper | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onAnalyze: () => void;
}) {
  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !paper) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="alert-circle-outline" size={40} color="#FF3B30" />
          </View>
          <Text style={styles.emptyTitle}>加载失败</Text>
          <Text style={styles.emptyText}>{error ?? "未找到该论文"}</Text>
          <NmButton variant="secondary" size="sm" onPress={onReload}>
            重试
          </NmButton>
        </View>
      </SafeAreaView>
    );
  }

  const s = STATUS_CONFIG[paper.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const tags = buildTags(paper);
  const hasAnalysis = paper.status === "analyzed" && paper.analysis;
  const hasGuide = paper.status === "analyzed" && paper.reproduction_guide;

  return (
    <SafeAreaView style={styles.screen}>
      <Header />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta */}
        <NmCard style={styles.metaCard}>
          <Text style={styles.paperTitle}>{paper.title}</Text>

          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((t) => (
                <View key={t.label} style={[styles.tag, { backgroundColor: t.bg }]}>
                  <Text style={[styles.tagText, { color: t.text }]}>{t.label}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.metaRow}>
            {paper.authors ? (
              <Text style={styles.metaText} numberOfLines={2}>{paper.authors}</Text>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {paper.venue ? <Text style={styles.metaText}>{paper.venue}</Text> : null}
            {paper.year ? <Text style={styles.metaText}> · {paper.year}</Text> : null}
          </View>

          <View style={styles.statusRow}>
            <Ionicons name={s.icon} size={14} color={s.color} />
            <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
          </View>

          {paper.status !== "analyzed" && paper.status !== "analyzing" && (
            <NmButton
              variant="primary"
              size="md"
              style={{ marginTop: 12 }}
              onPress={onAnalyze}
            >
              小妍分析
            </NmButton>
          )}
          {paper.status === "analyzing" && (
            <View style={styles.analyzingHint}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.analyzingText}>分析中…</Text>
            </View>
          )}
        </NmCard>

        {/* Abstract */}
        {paper.abstract ? (
          <NmCard style={styles.sectionCard}>
            <SectionHeader title="摘要" icon="document-text-outline" />
            <Text style={styles.bodyText}>{paper.abstract}</Text>
          </NmCard>
        ) : null}

        {/* Analysis */}
        {hasAnalysis && paper.analysis ? (
          <NmCard style={styles.sectionCard}>
            <SectionHeader title="分析结果" icon="sparkles" />
            <AnalysisBlock label="研究问题" content={paper.analysis.research_question} />
            <AnalysisBlock label="核心方法" content={paper.analysis.core_method} />
            <AnalysisBlock label="实验设计" content={paper.analysis.experiment_design} />
            <AnalysisBlock label="实验结果" content={paper.analysis.experiment_results} />
            <AnalysisBlock label="创新点" content={paper.analysis.innovations} />
            <AnalysisBlock label="局限性" content={paper.analysis.limitations} />
            <AnalysisBlock label="关键结论" content={paper.analysis.key_conclusions} />
          </NmCard>
        ) : null}

        {/* Reproduction Guide */}
        {hasGuide && paper.reproduction_guide ? (
          <NmCard style={styles.sectionCard}>
            <SectionHeader title="复现指南" icon="code-slash-outline" />
            <AnalysisBlock label="代码仓库" content={paper.reproduction_guide.code_repository} />
            <AnalysisBlock label="环境配置" content={paper.reproduction_guide.environment_setup} />
            <AnalysisBlock label="依赖项" content={paper.reproduction_guide.dependencies} />
            <AnalysisBlock label="数据集准备" content={paper.reproduction_guide.dataset_preparation} />
            <AnalysisBlock label="训练流程" content={paper.reproduction_guide.training_process} />
            <AnalysisBlock label="推理流程" content={paper.reproduction_guide.inference_process} />
            <AnalysisBlock label="评估指标" content={paper.reproduction_guide.evaluation_metrics} />
            <AnalysisBlock label="注意事项" content={paper.reproduction_guide.risks_and_notes} />
          </NmCard>
        ) : null}

        {/* No analysis yet */}
        {paper.status === "pending" || paper.status === "failed" ? (
          <NmCard style={styles.sectionCard}>
            <View style={styles.emptySection}>
              <Ionicons name="sparkles-outline" size={32} color="#5F6B7A" />
              <Text style={styles.emptySectionTitle}>
                {paper.status === "failed" ? "分析失败" : "暂未分析"}
              </Text>
              <Text style={styles.emptySectionText}>
                {paper.status === "failed"
                  ? "点击上方按钮重新分析该论文"
                  : "让小妍帮你解读这篇论文的研究问题、方法与结论"}
              </Text>
            </View>
          </NmCard>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#007AFF" />
        <Text style={styles.backText}>论文库</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#090B10" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { fontSize: 16, color: "#007AFF", fontWeight: "500" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  bottomSpacer: { height: 40 },

  metaCard: { marginTop: 4, padding: 16, gap: 10 },
  paperTitle: { fontSize: 20, fontWeight: "700", color: "#F5F7FA", lineHeight: 28 },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11, fontWeight: "600" },

  metaRow: { flexDirection: "row", flexWrap: "wrap" },
  metaText: { fontSize: 14, color: "#9AA7B8", lineHeight: 20 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { fontSize: 13, fontWeight: "500" },

  analyzingHint: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  analyzingText: { fontSize: 14, color: "#007AFF" },

  sectionCard: { marginTop: 12, padding: 16, gap: 14 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#F5F7FA" },

  bodyText: { fontSize: 15, lineHeight: 23, color: "#9AA7B8" },

  analysisBlock: { gap: 3 },
  analysisLabel: { fontSize: 13, fontWeight: "600", color: "#007AFF" },
  analysisContent: { fontSize: 14, lineHeight: 21, color: "#9AA7B8" },

  emptySection: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptySectionTitle: { fontSize: 16, fontWeight: "600", color: "#9AA7B8" },
  emptySectionText: { fontSize: 14, color: "#5F6B7A", textAlign: "center", paddingHorizontal: 20 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: "#141A23",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(60,74,92,0.5)",
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#9AA7B8" },
  emptyText: { fontSize: 14, color: "#5F6B7A", textAlign: "center", paddingHorizontal: 40 },
});
