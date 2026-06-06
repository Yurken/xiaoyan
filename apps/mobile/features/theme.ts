// ── Dark Mode Color Tokens ──
// Match the NmCard/NmButton component styling which already uses dark colors.

export const colors = {
  // Backgrounds
  bg: "#090B10",
  bgCard: "#141A23",
  bgCardInset: "#0F141C",
  bgInput: "#0F141C",
  bgHeader: "#141A23",

  // Text
  textPrimary: "#F5F7FA",
  textSecondary: "#9AA7B8",
  textMuted: "#5F6B7A",

  // Accent
  accent: "#007AFF",
  accentLight: "rgba(0,122,255,0.15)",

  // Status
  success: "#34C759",
  warning: "#FF9500",
  danger: "#FF3B30",

  // Borders
  border: "rgba(60,74,92,0.7)",
  borderLight: "rgba(60,74,92,0.35)",

  // Tags
  tagA: { bg: "#2D1518", text: "#FF6B6B" },
  tagB: { bg: "#2D1F12", text: "#FF9F43" },
  tagC: { bg: "#1A1830", text: "#A29BFE" },
  tagSCI: { bg: "#122A1E", text: "#4ADE80" },
  tagQuartile: { bg: "#1A1830", text: "#A29BFE" },
  tagCasQ: { bg: "#12202E", text: "#60A5FA" },
  tagTop: { bg: "#2D1518", text: "#FF6B6B" },

  // Empty state
  emptyIconBg: "#141A23",
  emptyIconBorder: "rgba(60,74,92,0.5)",

  // Misc
  skeleton: "#1A2433",
  overlay: "rgba(9,11,16,0.7)",
} as const;
