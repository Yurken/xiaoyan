import type { PptMode } from "./pptShared";

interface BuildPptPromptInput {
  mode: PptMode;
  topic: string;
  outline: string;
  documentContent: string | null;
  styleValue: string;
  customStyle: string;
  language: string;
  pageCount: string;
  customPages: string;
}

const JSON_SCHEMA = `{
  "title": "演示标题",
  "slides": [
    { "layout": "title", "title": "主标题", "subtitle": "副标题" },
    { "layout": "section", "title": "章节页标题", "subtitle": "章节说明（可选）" },
    { "layout": "content", "title": "内容页标题", "bullets": ["要点1", "要点2", "要点3"] },
    { "layout": "two_column", "title": "对比页标题", "left": ["左侧1", "左侧2"], "right": ["右侧1", "右侧2"] },
    { "layout": "highlight", "title": "核心结论页标题", "highlight": "一句话关键结论", "bullets": ["支撑点1", "支撑点2"] },
    { "layout": "timeline", "title": "流程页标题", "steps": ["阶段1", "阶段2", "阶段3"], "note": "流程说明（可选）" }
  ]
}`;

function buildDocumentExcerpt(text: string) {
  const normalized = text.trim();
  if (!normalized) return normalized;
  if (normalized.length <= 7000) return normalized;

  const head = normalized.slice(0, 4600);
  const tail = normalized.slice(-1800);
  return `${head}\n\n[中间已省略 ${normalized.length - 6400} 字原文，请优先根据上下文提炼核心逻辑]\n\n${tail}`;
}

function resolveStyleHint(styleValue: string, customStyle: string) {
  const effectiveStyle = styleValue === "custom" ? customStyle.trim() : styleValue;
  if (!effectiveStyle || effectiveStyle === "auto") {
    return "根据科研主题与内容深度选择最合适的学术汇报风格";
  }
  return `${effectiveStyle}风格`;
}

function resolveLanguageHint(language: string) {
  const languageHintMap: Record<string, string> = {
    auto: "语言根据主题自动决定，中文主题优先中文，英文主题优先英文",
    zh: "全程使用中文",
    en: "All slide copy must be written in English",
  };
  return languageHintMap[language] ?? languageHintMap.auto;
}

function resolvePageHint(pageCount: string, customPages: string) {
  const effectivePages = pageCount === "custom" ? customPages.trim() : pageCount;
  const customPageCount = Number.parseInt(effectivePages, 10);
  if (!Number.isFinite(customPageCount)) {
    return "页数由小妍根据内容深度自动决定，建议控制在 10 到 16 页";
  }
  return `总页数控制在 ${Math.min(40, Math.max(4, customPageCount))} 页左右，含标题页和致谢页`;
}

function buildRules(styleHint: string, languageHint: string, pageHint: string) {
  return `风格：${styleHint}
语言：${languageHint}
页数：${pageHint}
布局规则：
- layout 只能是 title / section / content / two_column / highlight / timeline
- 第一页固定用 title，最后一页也用 title 作为致谢或总结页
- 全文包含 2 到 3 个 section 分隔页
- content 页 bullets 每条尽量不超过 22 个字，最多 5 条
- two_column 只用于对比、并列方法或优缺点分析
- highlight 用于核心贡献、主要结论、takeaway，总结语必须简洁有力
- timeline 用于研究流程、方法步骤、实验阶段、时间线，steps 控制在 3 到 4 个
- 不要输出 markdown 代码块，不要输出任何解释性文字，只返回一个 JSON 对象
- 同一份 PPT 中优先使用多种布局，不要连续出现大量同构页面`;
}

export function buildPptPrompt(input: BuildPptPromptInput) {
  const styleHint = resolveStyleHint(input.styleValue, input.customStyle);
  const languageHint = resolveLanguageHint(input.language);
  const pageHint = resolvePageHint(input.pageCount, input.customPages);
  const commonRules = buildRules(styleHint, languageHint, pageHint);

  if (input.mode === "topic") {
    return `请为演示主题“${input.topic.trim()}”生成一份适合科研汇报的幻灯片数据。

严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明。
格式必须符合：
${JSON_SCHEMA}

${commonRules}`;
  }

  if (input.mode === "outline") {
    return `请根据以下大纲生成一份适合科研汇报的幻灯片数据：

${input.outline.trim()}

严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明。
格式必须符合：
${JSON_SCHEMA}

${commonRules}
- 严格按照大纲层级组织页面，必要时将连续要点合并成更有节奏的章节结构`;
  }

  return `请根据以下文档内容生成一份适合科研汇报的幻灯片数据：

${buildDocumentExcerpt(input.documentContent ?? "")}

严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明。
格式必须符合：
${JSON_SCHEMA}

${commonRules}
- 先提炼文档主线，再组织章节，不要机械地逐段复述原文`;
}

export function buildPptRepairPrompt(raw: string) {
  return `请把下面内容修复成一个合法、完整的 JSON 对象，只输出 JSON，不要解释。

要求：
- 顶层必须包含 title 和 slides
- slides 必须是数组
- layout 只能是 title / section / content / two_column / highlight / timeline
- 保留原始语义，缺失字段按最合理方式补全

待修复内容：
${raw.slice(0, 12000)}`;
}
