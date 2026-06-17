import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NmCard } from "../../components/NmCard";
import { colors } from "../theme";
import type { LearningPath } from "@research-copilot/types";

function SectionTitle({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={styles.sectionTitleText}>{text}</Text>
    </View>
  );
}

export function PlannerResult({ path }: { path: LearningPath }) {
  const [openStage, setOpenStage] = useState<number | null>(0);

  return (
    <View style={styles.wrap}>
      {path.overview ? (
        <NmCard style={styles.card}>
          <SectionTitle icon="compass-outline" text="领域概述" />
          <Text style={styles.bodyText}>{path.overview}</Text>
        </NmCard>
      ) : null}

      {path.prerequisites && path.prerequisites.length > 0 ? (
        <NmCard style={styles.card}>
          <SectionTitle icon="layers-outline" text="先修知识" />
          <View style={styles.gap10}>
            {path.prerequisites.map((p, i) => (
              <View key={i} style={styles.inset}>
                <Text style={styles.itemName}>{p.name}</Text>
                {p.description ? <Text style={styles.itemDesc}>{p.description}</Text> : null}
                {p.resources && p.resources.length > 0 ? (
                  <View style={styles.chipsRow}>
                    {p.resources.map((r, j) => (
                      <View key={j} style={styles.chip}>
                        <Text style={styles.chipText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </NmCard>
      ) : null}

      {path.learning_stages && path.learning_stages.length > 0 ? (
        <NmCard style={styles.card}>
          <SectionTitle icon="map-outline" text="学习路径" />
          <View style={styles.gap8}>
            {path.learning_stages.map((stage, i) => {
              const open = openStage === i;
              return (
                <View key={i} style={styles.stage}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.stageHeader}
                    onPress={() => setOpenStage(open ? null : i)}
                  >
                    <View style={styles.stageBadge}>
                      <Text style={styles.stageBadgeText}>{stage.stage}</Text>
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.stageTitle}>{stage.title}</Text>
                      {stage.duration ? <Text style={styles.stageDuration}>{stage.duration}</Text> : null}
                    </View>
                    <Ionicons
                      name={open ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>

                  {open ? (
                    <View style={styles.stageBody}>
                      {stage.goals && stage.goals.length > 0 ? (
                        <View>
                          <Text style={styles.subLabel}>学习目标</Text>
                          {stage.goals.map((g, j) => (
                            <View key={j} style={styles.bulletRow}>
                              <Text style={styles.bulletDot}>•</Text>
                              <Text style={styles.bulletText}>{g}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {stage.topics && stage.topics.length > 0 ? (
                        <View>
                          <Text style={styles.subLabel}>涵盖主题</Text>
                          <View style={styles.chipsRow}>
                            {stage.topics.map((t, j) => (
                              <View key={j} style={styles.chipAccent}>
                                <Text style={styles.chipAccentText}>{t}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                      {stage.resources && stage.resources.length > 0 ? (
                        <View>
                          <Text style={styles.subLabel}>推荐资源</Text>
                          {stage.resources.map((r, j) => (
                            <View key={j} style={styles.bulletRow}>
                              <Ionicons name="book-outline" size={13} color={colors.textMuted} />
                              <Text style={styles.bulletText}>{r}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </NmCard>
      ) : null}

      {path.classic_papers && path.classic_papers.length > 0 ? (
        <NmCard style={styles.card}>
          <SectionTitle icon="ribbon-outline" text="经典必读论文" />
          <View style={styles.gap10}>
            {path.classic_papers.map((p, i) => (
              <View key={i} style={styles.paperRow}>
                <Text style={styles.paperIndex}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={styles.flex1}>
                  <Text style={styles.itemName}>{p.title}</Text>
                  <Text style={styles.paperMeta}>
                    {[p.authors, p.year ? String(p.year) : "", p.venue ?? ""].filter(Boolean).join(" · ")}
                  </Text>
                  {p.reason ? <Text style={styles.itemDesc}>{p.reason}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </NmCard>
      ) : null}

      {path.research_directions && path.research_directions.length > 0 ? (
        <NmCard style={styles.card}>
          <SectionTitle icon="telescope-outline" text="进一步探索方向" />
          <View style={styles.gap10}>
            {path.research_directions.map((d, i) => (
              <View key={i} style={styles.inset}>
                <Text style={styles.itemName}>{d.direction}</Text>
                {d.description ? <Text style={styles.itemDesc}>{d.description}</Text> : null}
                {d.open_problems && d.open_problems.length > 0
                  ? d.open_problems.slice(0, 3).map((op, j) => (
                      <View key={j} style={styles.bulletRow}>
                        <Text style={styles.bulletArrow}>→</Text>
                        <Text style={styles.bulletText}>{op}</Text>
                      </View>
                    ))
                  : null}
              </View>
            ))}
          </View>
        </NmCard>
      ) : null}

      {path.tools_and_frameworks && path.tools_and_frameworks.length > 0 ? (
        <NmCard style={styles.card}>
          <SectionTitle icon="construct-outline" text="常用工具 & 框架" />
          <View style={styles.chipsRow}>
            {path.tools_and_frameworks.map((t, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
        </NmCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: { gap: 12 },
  flex1: { flex: 1 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },

  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitleText: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },

  bodyText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },

  inset: { backgroundColor: colors.bgCardInset, borderRadius: 14, padding: 12, gap: 6 },
  itemName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, lineHeight: 20 },
  itemDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: { backgroundColor: colors.bgCardInset, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipAccent: { backgroundColor: colors.accentLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipAccentText: { fontSize: 12, color: colors.accent },

  stage: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 14, overflow: "hidden" },
  stageHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  stageBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  stageBadgeText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  stageTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  stageDuration: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  stageBody: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2, gap: 12 },

  subLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 },
  bulletRow: { flexDirection: "row", gap: 7, alignItems: "flex-start", marginBottom: 3 },
  bulletDot: { fontSize: 14, color: colors.accent, lineHeight: 19 },
  bulletArrow: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  bulletText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  paperRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  paperIndex: { fontSize: 18, fontWeight: "800", color: colors.skeleton },
  paperMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
