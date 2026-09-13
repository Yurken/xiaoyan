// 小妍浅色新拟态令牌。移动端与桌面端 Light Mode 使用同一组表面与文本层级。

export const colors = {
  // Backgrounds
  bg: "#F0F4F8",
  bgCard: "#F4F6F9",
  bgCardInset: "#E2E6EC",
  bgInput: "#E8ECF0",
  bgHeader: "#E8ECF0",

  // Text
  textPrimary: "#1A2233",
  textSecondary: "#3C4655",
  textMuted: "#596270",

  // Accent
  accent: "#0062CC",
  accentBright: "#007AFF",
  accentStrong: "#0057B8",
  accentFaint: "rgba(0,122,255,0.08)",
  accentSubtle: "rgba(0,122,255,0.1)",
  accentLight: "rgba(0,122,255,0.15)",
  accentSoft: "rgba(0,122,255,0.16)",
  accentBorder: "rgba(0,122,255,0.4)",

  // Status
  success: "#137333",
  warning: "#8A5200",
  danger: "#C1271D",
  dangerStrong: "#A61F17",
  purple: "#6741D9",
  successSoft: "rgba(52,199,89,0.14)",
  warningSoft: "rgba(255,149,0,0.14)",
  dangerSoft: "rgba(255,59,48,0.14)",
  purpleSoft: "rgba(175,82,222,0.14)",

  // Borders
  border: "rgba(200,205,211,0.7)",
  borderLight: "rgba(200,205,211,0.45)",
  highlight: "#F8FAFC",
  highlightBorder: "rgba(248,250,252,0.82)",
  shadow: "#C8CDD3",

  // Tags
  tagA: { bg: "#FFE8E8", text: "#D93025" },
  tagB: { bg: "#FFF3E0", text: "#C05A00" },
  tagC: { bg: "#F3F0FF", text: "#6741D9" },
  tagSCI: { bg: "#E6F4EA", text: "#137333" },
  tagQuartile: { bg: "#EDE7F6", text: "#5E35B1" },
  tagCasQ: { bg: "#E3F2FD", text: "#1565C0" },
  tagTop: { bg: "#FCE4EC", text: "#C62828" },

  // Empty state
  emptyIconBg: "#E8ECF0",
  emptyIconBorder: "rgba(200,205,211,0.6)",

  // Misc
  skeleton: "#D8DEE6",
  overlay: "rgba(26,34,51,0.46)",
} as const;
