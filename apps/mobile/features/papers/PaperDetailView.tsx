import { colors } from "../theme";
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
import type { PaperDetailSource } from "./usePaperDetail";

const STATUS_CONFIG = {
  analyzed:  { icon: "checkmark-circle" as const, color: colors.success, label: "已分析" },
  analyzing: { icon: "hourglass"         as const, color: colors.accent, label: "处理中" },
  failed:    { icon: "close-circle"      as const, color: colors.danger, label: "失败"   },
  pending:   { icon: "ellipse-outline"   as const, color: colors.textMuted, label: "待分析" },
};

const CCF_COLORS: Record<string, { bg: string; text: string }> = {
  A: colors.tagA,
  B: colors.tagB,
  C: colors.tagC,
};

function buildTags(paper: Paper) {
  const tags: Array<{ label: string; bg: string; text: string }> = [];
  if (paper.ccf_rating) {
    const c = CCF_COLORS[paper.ccf_rating] ?? colors.tagCasQ;
    tags.push({ label: `CCF ${paper.ccf_rating}`, bg: c.bg, text: c.text });
  }
  if (paper.wos_indexes) {
    for (const idx of paper.wos_indexes) {
      if (idx === "SCI" || idx === "SSCI" || idx === "EI") {
        tags.push({ label: idx, ...colors.tagSCI });
      }
    }
  }
  if (paper.jcr_quartile) {
    tags.push({ label: paper.jcr_quartile, ...colors.tagQuartile });
  }
  if (paper.cas_quartile) {
    tags.push({ label: `中科院${paper.cas_quartile}`, ...colors.tagCasQ });
  }
  if (paper.cas_top) {
    tags.push({ label: "顶刊", ...colors.tagTop });
  }
  return tags;
}

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={colors.accent} />
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
  source,
  analyzing,
  canAnalyze,
  onReload,
  onAnalyze,
}: {
  paper: Paper | null;
  loading: boolean;
  error: string | null;
  source: PaperDetailSource;
  analyzing: boolean;
  canAnalyze: boolean;
  onReload: () => void | Promise<void>;
  onAnalyze: () => void | Promise<void>;
}) {
  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
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
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          </View>
          <Text style={styles.emptyTitle}>加载失败</Text>
          <Text style={styles.emptyText}>{error ?? "未找到该论文"}</Text>
          <NmButton variant="secondary" size="sm" onPress={() => { void onReload(); }}>
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
        {source === "synced" ? (
          <View style={styles.syncedBanner}>
            <Text style={styles.syncedText}>WebDAV 同步副本 · 只读</Text>
          </View>
        ) : null}

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
              disabled={!canAnalyze || analyzing}
              onPress={() => { void onAnalyze(); }}
            >
              {!canAnalyze ? "只读" : analyzing ? "分析中…" : "小妍分析"}
            </NmButton>
          )}
          {paper.status === "analyzing" && (
            <View style={styles.analyzingHint}>
              <ActivityIndicator size="small" color={colors.accent} />
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
              <Ionicons name="sparkles-outline" size={32} color={colors.textMuted} />
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
        <Ionicons name="chevron-back" size={22} color={colors.accent} />
        <Text style={styles.backText}>论文库</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { fontSize: 16, color: colors.accent, fontWeight: "500" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  bottomSpacer: { height: 40 },

  syncedBanner: {
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
  },
  syncedText: { fontSize: 13, color: colors.accentStrong, fontWeight: "500" },

  metaCard: { marginTop: 4, padding: 16, gap: 10 },
  paperTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary, lineHeight: 28 },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11, fontWeight: "600" },

  metaRow: { flexDirection: "row", flexWrap: "wrap" },
  metaText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { fontSize: 13, fontWeight: "500" },

  analyzingHint: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  analyzingText: { fontSize: 14, color: colors.accent },

  sectionCard: { marginTop: 12, padding: 16, gap: 14 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },

  bodyText: { fontSize: 15, lineHeight: 23, color: colors.textSecondary },

  analysisBlock: { gap: 3 },
  analysisLabel: { fontSize: 13, fontWeight: "600", color: colors.accent },
  analysisContent: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },

  emptySection: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptySectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  emptySectionText: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingHorizontal: 20 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.textSecondary },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingHorizontal: 40 },
});
