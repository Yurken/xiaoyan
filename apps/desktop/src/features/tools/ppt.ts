import PptxGenJS from "pptxgenjs";

type PptLayout = "title" | "section" | "content" | "two_column";

interface PptSlide {
  layout: PptLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: string[];
  right?: string[];
}

export interface PptData {
  title: string;
  slides: PptSlide[];
}

export function sanitizePptFileName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
  return cleaned || "slides";
}

export function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("模型未返回有效 JSON 对象。");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, index + 1);
    }
  }

  throw new Error("模型返回的 JSON 不完整，请重试。");
}

export function normalizePptData(input: unknown): PptData {
  if (!input || typeof input !== "object") {
    throw new Error("模型返回格式错误：缺少演示数据对象。");
  }
  const raw = input as { title?: unknown; slides?: unknown };
  if (!Array.isArray(raw.slides) || raw.slides.length === 0) {
    throw new Error("模型返回格式错误：slides 不能为空。");
  }

  const validLayouts: PptLayout[] = ["title", "section", "content", "two_column"];
  const slides: PptSlide[] = raw.slides.slice(0, 40).map((slide, index) => {
    const source = (slide && typeof slide === "object" ? slide : {}) as Record<string, unknown>;
    const layout = (typeof source.layout === "string" && validLayouts.includes(source.layout as PptLayout)
      ? source.layout
      : "content") as PptLayout;
    const title = typeof source.title === "string" && source.title.trim() ? source.title.trim() : `第 ${index + 1} 页`;

    const toLines = (value: unknown) =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 5)
        : undefined;

    return {
      layout,
      title,
      subtitle: typeof source.subtitle === "string" ? source.subtitle.trim() || undefined : undefined,
      bullets: toLines(source.bullets),
      left: toLines(source.left),
      right: toLines(source.right),
    };
  });

  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "演示文稿",
    slides,
  };
}

export async function buildPptx(data: PptData): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const width = 13.33;
  const height = 7.5;
  const colors = {
    navy: "0D1B2A",
    blue: "007AFF",
    white: "FFFFFF",
    text: "1A2233",
    border: "D0D6DC",
    light: "F4F6F9",
  };

  for (const slide of data.slides) {
    const pptSlide = pptx.addSlide();

    if (slide.layout === "title") {
      pptSlide.background = { color: colors.navy };
      pptSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: width, h: height, fill: { type: "solid", color: colors.blue, transparency: 72 } });
      pptSlide.addShape(pptx.ShapeType.rect, { x: 0, y: height - 0.18, w: width, h: 0.18, fill: { type: "solid", color: colors.blue, transparency: 0 } });
      pptSlide.addText(slide.title, { x: 1.2, y: 2.3, w: width - 2.4, h: 1.6, fontSize: 42, bold: true, color: colors.white, align: "center", valign: "middle" });
      if (slide.subtitle) pptSlide.addText(slide.subtitle, { x: 1.2, y: 4.1, w: width - 2.4, h: 0.9, fontSize: 20, color: "AACCFF", align: "center" });
    } else if (slide.layout === "section") {
      pptSlide.background = { color: colors.blue };
      pptSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: height, fill: { type: "solid", color: colors.white, transparency: 40 } });
      pptSlide.addText(slide.title, { x: 0.8, y: 2.6, w: width - 1.6, h: 1.4, fontSize: 36, bold: true, color: colors.white, align: "center", valign: "middle" });
      if (slide.subtitle) pptSlide.addText(slide.subtitle, { x: 0.8, y: 4.2, w: width - 1.6, h: 0.8, fontSize: 18, color: "DDEEFF", align: "center" });
    } else if (slide.layout === "content") {
      pptSlide.background = { color: colors.light };
      pptSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: width, h: 1.25, fill: { type: "solid", color: colors.navy } });
      pptSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: width, h: 0.06, fill: { type: "solid", color: colors.blue } });
      pptSlide.addText(slide.title, { x: 0.5, y: 0.18, w: width - 1, h: 0.9, fontSize: 26, bold: true, color: colors.white, valign: "middle" });
      if (slide.bullets?.length) {
        pptSlide.addText(
          slide.bullets.map((bullet) => ({ text: bullet, options: { bullet: { code: "2022" }, paraSpaceAfter: 10 } })),
          { x: 0.7, y: 1.55, w: width - 1.4, h: height - 2, fontSize: 19, color: colors.text, valign: "top", lineSpacingMultiple: 1.3 }
        );
      }
    } else if (slide.layout === "two_column") {
      pptSlide.background = { color: colors.light };
      pptSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: width, h: 1.25, fill: { type: "solid", color: colors.navy } });
      pptSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: width, h: 0.06, fill: { type: "solid", color: colors.blue } });
      pptSlide.addText(slide.title, { x: 0.5, y: 0.18, w: width - 1, h: 0.9, fontSize: 26, bold: true, color: colors.white, valign: "middle" });
      pptSlide.addShape(pptx.ShapeType.line, { x: width / 2, y: 1.5, w: 0, h: height - 1.9, line: { color: colors.border, width: 1 } });
      const columnOptions = { fontSize: 18, color: colors.text, valign: "top" as const, lineSpacingMultiple: 1.3 };
      if (slide.left?.length) pptSlide.addText(slide.left.map((bullet) => ({ text: bullet, options: { bullet: { code: "2022" }, paraSpaceAfter: 8 } })), { x: 0.5, y: 1.55, w: width / 2 - 0.8, h: height - 2, ...columnOptions });
      if (slide.right?.length) pptSlide.addText(slide.right.map((bullet) => ({ text: bullet, options: { bullet: { code: "2022" }, paraSpaceAfter: 8 } })), { x: width / 2 + 0.3, y: 1.55, w: width / 2 - 0.8, h: height - 2, ...columnOptions });
    }
  }

  return (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
}
