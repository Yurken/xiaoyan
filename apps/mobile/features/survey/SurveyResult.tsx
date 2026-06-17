import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { colors } from "../theme";
import type { SurveyData, SurveyPaper } from "./shared";

type Tab = "report" | "papers";

function SectionTitle({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={styles.sectionTitleText}>{text}</Text>
    </View>
  );
}

function PaperCard({ paper, index }: { paper: SurveyPaper; index: number }) {
  const meta = [paper.year ? String(paper.year) : "", paper.venue].filter(Boolean).join(" · ");
  return (
    <NmCard style={styles.paperCard}>
      <View style={styles.paperHead}>
        <Text style={styles.paperIndex}>[{index + 1}]</Text>
        <Text style={styles.paperTitle}>{paper.title}</Text>
      </View>
      <Text style={styles.paperAuthors}>{paper.authors}</Text>
      <View style={styles.paperBadges}>
        {meta ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{meta}</Text>
          </View>
        ) : null}
        {paper.citation_count > 0 ? (
          <View style={styles.badgeCite}>
            <Text style={styles.badgeCiteText}>引用 {paper.citation_count}</Text>
          </View>
        ) : null}
      </View>
      {paper.abstract ? (
        <Text style={styles.paperAbstract} numberOfLines={3}>
          {paper.abstract}
        </Text>
      ) : null}
      {paper.pdf_url ? (
        <TouchableOpacity
          style={styles.pdfLink}
          activeOpacity={0.7}
          onPress={() => Linking.openURL(paper.pdf_url)}
        >
          <Ionicons name="open-outline" size={14} color={colors.accent} />
          <Text style={styles.pdfLinkText}>查看原文</Text>
        </TouchableOpacity>
      ) : null}
    </NmCard>
  );
}

export function SurveyResult({ data }: { data: SurveyData }) {
  const [tab, setTab] = useState<Tab>("report");

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        <TouchableOpacity
          style={[styles.segmentItem, tab === "report" && styles.segmentActive]}
          activeOpacity={0.8}
          onPress={() => setTab("report")}
        >
          <Text style={[styles.segmentText, tab === "report" && styles.segmentTextActive]}>综述报告</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentItem, tab === "papers" && styles.segmentActive]}
          activeOpacity={0.8}
          onPress={() => setTab("papers")}
        >
          <Text style={[styles.segmentText, tab === "papers" && styles.segmentTextActive]}>
            检索论文 ({data.papers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "report" ? (
        <View style={styles.gap14}>
          {data.background ? (
            <NmCard style={styles.card}>
              <SectionTitle icon="reader-outline" text="研究背景" />
              <Text style={styles.bodyText}>{data.background}</Text>
            </NmCard>
          ) : null}

          {data.representative_methods.length > 0 ? (
            <NmCard style={styles.card}>
              <SectionTitle icon="git-branch-outline" text="代表性方法" />
              <View style={styles.gap10}>
                {data.representative_methods.map((m, i) => (
                  <View key={i} style={styles.inset}>
                    <Text style={styles.itemName}>{m.category}</Text>
                    {m.description ? <Text style={styles.itemDesc}>{m.description}</Text> : null}
                    {m.strengths ? (
                      <Text style={styles.metaLine}>
                        <Text style={styles.strong}>优势：</Text>
                        {m.strengths}
                      </Text>
                    ) : null}
                    {m.weaknesses ? (
                      <Text style={styles.metaLine}>
                        <Text style={styles.weak}>局限：</Text>
                        {m.weaknesses}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </NmCard>
          ) : null}

          {data.research_trends.length > 0 ? (
            <NmCard style={styles.card}>
              <SectionTitle icon="trending-up-outline" text="研究趋势" />
              <View style={styles.gap10}>
                {data.research_trends.map((t, i) => (
                  <View key={i} style={styles.trendRow}>
                    <View style={styles.trendBar} />
                    <View style={styles.flex1}>
                      <Text style={styles.itemName}>{t.trend}</Text>
                      {t.description ? <Text style={styles.itemDesc}>{t.description}</Text> : null}
                      {t.evidence ? <Text style={styles.evidence}>{t.evidence}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            </NmCard>
          ) : null}

          {data.existing_gaps.length > 0 ? (
            <NmCard style={styles.card}>
              <SectionTitle icon="alert-circle-outline" text="现有不足" />
              <View style={styles.gap6}>
                {data.existing_gaps.map((g, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.warnMark}>⚠</Text>
                    <Text style={styles.bulletText}>{g}</Text>
                  </View>
                ))}
              </View>
            </NmCard>
          ) : null}

          {data.future_directions.length > 0 ? (
            <NmCard style={styles.card}>
              <SectionTitle icon="bulb-outline" text="未来方向" />
              <View style={styles.gap8}>
                {data.future_directions.map((d, i) => (
                  <View key={i} style={styles.futureItem}>
                    <Text style={styles.futureName}>{d.direction}</Text>
                    {d.rationale ? <Text style={styles.futureReason}>{d.rationale}</Text> : null}
                  </View>
                ))}
              </View>
            </NmCard>
          ) : null}

          {data.key_takeaways ? (
            <NmCard style={{ ...styles.card, ...styles.takeaway }}>
              <SectionTitle icon="sparkles-outline" text="核心总结" />
              <Text style={styles.bodyText}>{data.key_takeaways}</Text>
            </NmCard>
          ) : null}
        </View>
      ) : (
        <View style={styles.gap12}>
          {data.papers.length === 0 ? (
            <Text style={styles.emptyPapers}>本次未检索到论文</Text>
          ) : (
            data.papers.map((p, i) => <PaperCard key={i} paper={p} index={i} />)
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  card: { gap: 12 },
  flex1: { flex: 1 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  gap14: { gap: 14 },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.bgCardInset,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  segmentTextActive: { color: "#FFFFFF" },

  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitleText: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  bodyText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },

  inset: { backgroundColor: colors.bgCardInset, borderRadius: 14, padding: 12, gap: 5 },
  itemName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, lineHeight: 20 },
  itemDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  metaLine: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  strong: { color: colors.success, fontWeight: "600" },
  weak: { color: colors.warning, fontWeight: "600" },

  trendRow: { flexDirection: "row", gap: 10 },
  trendBar: { width: 3, borderRadius: 2, backgroundColor: colors.accent },
  evidence: { fontSize: 12, color: colors.textMuted, fontStyle: "italic", marginTop: 2 },

  bulletRow: { flexDirection: "row", gap: 7, alignItems: "flex-start" },
  warnMark: { fontSize: 13, color: colors.warning, lineHeight: 19 },
  bulletText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  futureItem: { backgroundColor: "rgba(52,199,89,0.1)", borderRadius: 12, padding: 11 },
  futureName: { fontSize: 14, fontWeight: "600", color: colors.success },
  futureReason: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },

  takeaway: { borderColor: "rgba(0,122,255,0.4)", backgroundColor: "rgba(0,122,255,0.08)" },

  paperCard: { gap: 7 },
  paperHead: { flexDirection: "row", gap: 6 },
  paperIndex: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  paperTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.textPrimary, lineHeight: 20 },
  paperAuthors: { fontSize: 12, color: colors.textMuted },
  paperBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { backgroundColor: colors.bgCardInset, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: colors.textSecondary },
  badgeCite: { backgroundColor: "rgba(52,199,89,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeCiteText: { fontSize: 11, color: colors.success },
  paperAbstract: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  pdfLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  pdfLinkText: { fontSize: 13, color: colors.accent, fontWeight: "500" },

  emptyPapers: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: 30 },
});
