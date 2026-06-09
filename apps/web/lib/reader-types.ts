/** Reader / annotation type definitions */

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export const HIGHLIGHT_COLORS: Record<
  HighlightColor,
  { bg: string; border: string; label: string }
> = {
  yellow: { bg: "rgba(253, 224, 71, 0.35)", border: "rgba(253, 224, 71, 0.7)", label: "黄色" },
  green: { bg: "rgba(74, 222, 128, 0.30)", border: "rgba(74, 222, 128, 0.6)", label: "绿色" },
  blue: { bg: "rgba(96, 165, 250, 0.30)", border: "rgba(96, 165, 250, 0.6)", label: "蓝色" },
  pink: { bg: "rgba(244, 114, 182, 0.30)", border: "rgba(244, 114, 182, 0.6)", label: "粉色" },
  purple: { bg: "rgba(167, 139, 250, 0.30)", border: "rgba(167, 139, 250, 0.6)", label: "紫色" },
};

export interface PaperNote {
  id: string;
  paper_id: string;
  page: number;
  content: string;
  highlight_text?: string;
  highlight_color: HighlightColor;
  highlight_positions?: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  created_at: string;
  updated_at: string;
}

/** Storage key helper */
export function notesStorageKey(paperId: string): string {
  return `xiaoyan_paper_notes_${paperId}`;
}
