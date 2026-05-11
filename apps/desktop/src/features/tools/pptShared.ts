export type PptMode = "topic" | "document" | "outline";
export type PptStatus = "idle" | "drafting" | "repairing" | "building" | "ready" | "error";
export type PptLayout = "title" | "section" | "content" | "two_column" | "highlight" | "timeline";

export interface PptSlide {
  layout: PptLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: string[];
  right?: string[];
  highlight?: string;
  steps?: string[];
  note?: string;
}

export interface PptData {
  title: string;
  slides: PptSlide[];
}

export const STYLE_OPTIONS = [
  { value: "auto", label: "小妍推荐" },
  { value: "拟态", label: "拟态" },
  { value: "文献综述", label: "文献综述" },
  { value: "实验汇报", label: "实验汇报" },
  { value: "开题答辩", label: "开题答辩" },
  { value: "技术路线", label: "技术路线" },
  { value: "custom", label: "自定义" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "auto", label: "小妍推荐" },
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
] as const;

export const PAGE_OPTIONS = [
  { value: "auto", label: "小妍推荐" },
  { value: "8", label: "8 页" },
  { value: "12", label: "12 页" },
  { value: "16", label: "16 页" },
  { value: "20", label: "20 页" },
  { value: "custom", label: "自定义" },
] as const;

export const PPT_LAYOUT_LABELS: Record<PptLayout, string> = {
  title: "标题页",
  section: "章节页",
  content: "内容页",
  two_column: "双列页",
  highlight: "结论页",
  timeline: "流程页",
};

export function summarizeSlideContent(slide: PptSlide) {
  if (slide.layout === "highlight") {
    return [slide.highlight, ...(slide.bullets ?? [])].filter(Boolean).join(" · ");
  }
  if (slide.layout === "timeline") {
    return [...(slide.steps ?? []), slide.note].filter(Boolean).join(" → ");
  }
  if (slide.layout === "two_column") {
    return [...(slide.left ?? []), ...(slide.right ?? [])].filter(Boolean).join(" · ");
  }
  return [slide.subtitle, ...(slide.bullets ?? [])].filter(Boolean).join(" · ");
}
