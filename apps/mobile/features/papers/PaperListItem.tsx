import { colors } from "../theme";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { NmButton } from "../../components/NmButton";
import type { Paper } from "@research-copilot/types";

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

const INDEX_TAGS: Record<string, { bg: string; text: string }> = {
  SCI: colors.tagSCI,
  SSCI: colors.tagSCI,
  EI: colors.tagSCI,
};

function buildTags(paper: Paper): Array<{ label: string; bg: string; text: string }> {
  const tags: Array<{ label: string; bg: string; text: string }> = [];
  if (paper.ccf_rating) {
    const c = CCF_COLORS[paper.ccf_rating] ?? colors.tagCasQ;
    tags.push({ label: `CCF ${paper.ccf_rating}`, bg: c.bg, text: c.text });
  }
  if (paper.wos_indexes) {
    for (const idx of paper.wos_indexes) {
      const c = INDEX_TAGS[idx];
      if (c) tags.push({ label: idx, bg: c.bg, text: c.text });
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

export function PaperListItem({
  paper,
  progress,
  canAnalyze,
  onAnalyze,
  onPress,
}: {
  paper: Paper;
  progress?: number;
  canAnalyze: boolean;
  onAnalyze: (id: string) => void;
  onPress: (id: string) => void;
}) {
  const s = STATUS_CONFIG[paper.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const tags = buildTags(paper);
  const analyzeDisabled = !canAnalyze || paper.status === "analyzing";

  return (
    <NmCard style={styles.paperCard}>
      <TouchableOpacity
        style={styles.paperTouchable}
        activeOpacity={0.65}
        onPress={() => onPress(paper.id)}
      >
        <View style={styles.paperInfo}>
          <Text style={styles.paperTitle} numberOfLines={2}>{paper.title}</Text>
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((t) => (
                <View key={t.label} style={[styles.tag, { backgroundColor: t.bg }]}>
                  <Text style={[styles.tagText, { color: t.text }]}>{t.label}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.paperMeta}>
            <Text style={styles.paperDate}>
              {new Date(paper.created_at).toLocaleDateString("zh-CN")}
            </Text>
            <View style={styles.statusBadge}>
              <Ionicons name={s.icon} size={12} color={s.color} />
              <Text style={[styles.paperStatus, { color: s.color }]}>
                {s.label}
                {paper.status === "analyzing" && progress != null ? ` ${progress}%` : ""}
              </Text>
            </View>
          </View>
          {paper.status === "analyzing" && progress != null && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          )}
        </View>
      </TouchableOpacity>
      <NmButton
        variant="secondary"
        size="sm"
        disabled={analyzeDisabled}
        style={styles.analyzeBtn}
        onPress={() => onAnalyze(paper.id)}
      >
        {canAnalyze ? "小妍分析" : "只读"}
      </NmButton>
    </NmCard>
  );
}

const styles = StyleSheet.create({
  paperCard: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  paperTouchable: { flex: 1 },
  paperInfo: { flex: 1 },
  paperTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, lineHeight: 22 },
  tagsRow:   { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText:   { fontSize: 11, fontWeight: "600" },
  paperMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  paperDate: { fontSize: 12, color: colors.textMuted },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  paperStatus: { fontSize: 12, fontWeight: "500" },
  analyzeBtn: { flexShrink: 0 },
  progressBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentLight,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
