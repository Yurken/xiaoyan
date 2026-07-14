export type DocumentCheckSeverity = "error" | "warning" | "info";
export type DocumentCheckCategory = "page" | "font" | "heading" | "figure" | "citation" | "hidden";

export interface DocumentCheckIssue {
  id: string;
  severity: DocumentCheckSeverity;
  category: DocumentCheckCategory;
  message: string;
  location?: string;
  suggestion: string;
}

export interface DocumentInspection {
  fileName: string;
  fileType: "pdf" | "docx";
  pageCount: number | null;
  pageWidthMm: number | null;
  pageHeightMm: number | null;
  marginsMm: { top: number; right: number; bottom: number; left: number } | null;
  fonts: string[];
  fontSizesPt: number[];
  text: string;
  pageNumbers: number[];
  blankPages: number[];
  hasComments: boolean;
  hasRevisions: boolean;
}

export interface DocumentCheckRules {
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  bodyFont: string;
  bodyFontSizePt: number;
  maxPages: number | null;
  checkReferences: boolean;
}

export interface DocumentTemplate {
  id: "cn-thesis" | "nsfc" | "gb7714" | "custom";
  name: string;
  description: string;
  rules: DocumentCheckRules;
}

export interface DocumentCheckReport {
  inspection: DocumentInspection;
  issues: DocumentCheckIssue[];
  passed: string[];
  checkedAt: string;
}

const BASE_RULES: DocumentCheckRules = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginTopMm: 25.4,
  marginRightMm: 25.4,
  marginBottomMm: 25.4,
  marginLeftMm: 25.4,
  bodyFont: "宋体",
  bodyFontSizePt: 12,
  maxPages: null,
  checkReferences: true,
};

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "cn-thesis",
    name: "中国学位论文（通用基线）",
    description: "A4、常用中文正文与页码/图表/参考文献自查；请按学校模板调整。",
    rules: BASE_RULES,
  },
  {
    id: "nsfc",
    name: "国家自然科学基金材料（通用基线）",
    description: "检查 A4 页面、常用正文样式、页码和材料中的残留批注。",
    rules: { ...BASE_RULES, marginTopMm: 20, marginRightMm: 20, marginBottomMm: 20, marginLeftMm: 20 },
  },
  {
    id: "gb7714",
    name: "GB/T 7714 引用自查",
    description: "侧重顺序编码引用、参考文献列表、图表与页码连续性。",
    rules: { ...BASE_RULES, bodyFont: "", bodyFontSizePt: 0 },
  },
  {
    id: "custom",
    name: "自定义规则",
    description: "按投稿通知、单位模板或编辑部要求填写页面与正文规则。",
    rules: BASE_RULES,
  },
];

export function getDocumentTemplate(id: DocumentTemplate["id"]): DocumentTemplate {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id) ?? DOCUMENT_TEMPLATES[0];
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeFontName(value: string) {
  return value.toLocaleLowerCase().replace(/[+\s_-]/g, "");
}

function fontMatches(actual: string[], expected: string) {
  if (!expected.trim()) return true;
  const aliases: Record<string, string[]> = {
    宋体: ["宋体", "simsun", "songti", "stsong"],
    黑体: ["黑体", "simhei", "heiti", "stheiti"],
    "timesnewroman": ["timesnewroman", "times", "liberationserif"],
  };
  const expectedName = normalizeFontName(expected);
  const candidates = aliases[expectedName] ?? [expectedName];
  return actual.some((font) => candidates.some((candidate) => normalizeFontName(font).includes(normalizeFontName(candidate))));
}

function checkNumberSequence(text: string, pattern: RegExp): number[] {
  return [...text.matchAll(pattern)].map((match) => Number(match[1])).filter(Number.isFinite);
}

function missingNumbers(values: number[]) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length < 2) return [];
  const missing: number[] = [];
  for (let value = unique[0]; value <= unique[unique.length - 1]; value += 1) {
    if (!unique.includes(value)) missing.push(value);
  }
  return missing;
}

export function evaluateDocument(inspection: DocumentInspection, rules: DocumentCheckRules): DocumentCheckReport {
  const issues: DocumentCheckIssue[] = [];
  const passed: string[] = [];
  const add = (issue: Omit<DocumentCheckIssue, "id">) => issues.push({ id: `${issue.category}-${issues.length + 1}`, ...issue });

  if (inspection.pageWidthMm && inspection.pageHeightMm) {
    const direct = Math.abs(inspection.pageWidthMm - rules.pageWidthMm) <= 2 && Math.abs(inspection.pageHeightMm - rules.pageHeightMm) <= 2;
    const rotated = Math.abs(inspection.pageWidthMm - rules.pageHeightMm) <= 2 && Math.abs(inspection.pageHeightMm - rules.pageWidthMm) <= 2;
    if (direct || rotated) passed.push(`纸张尺寸符合规则（${rounded(inspection.pageWidthMm)} × ${rounded(inspection.pageHeightMm)} mm）`);
    else add({ severity: "error", category: "page", message: `纸张尺寸为 ${rounded(inspection.pageWidthMm)} × ${rounded(inspection.pageHeightMm)} mm，要求 ${rules.pageWidthMm} × ${rules.pageHeightMm} mm`, suggestion: "在页面设置中统一纸张大小，并检查是否混入横向或其他尺寸页面。" });
  } else add({ severity: "info", category: "page", message: "未能读取可靠的纸张尺寸", suggestion: "请在原始排版软件中人工确认纸张大小。" });

  if (inspection.marginsMm) {
    const expected = [rules.marginTopMm, rules.marginRightMm, rules.marginBottomMm, rules.marginLeftMm];
    const actual = [inspection.marginsMm.top, inspection.marginsMm.right, inspection.marginsMm.bottom, inspection.marginsMm.left];
    const labels = ["上", "右", "下", "左"];
    const mismatches = actual.map((value, index) => Math.abs(value - expected[index]) > 3 ? `${labels[index]} ${rounded(value)} mm（要求 ${expected[index]} mm）` : "").filter(Boolean);
    if (mismatches.length === 0) passed.push("页边距在允许误差范围内");
    else add({ severity: "warning", category: "page", message: `页边距可能不符合：${mismatches.join("；")}`, suggestion: inspection.fileType === "pdf" ? "PDF 页边距按正文边界估算，请回到 Word/LaTeX 页面设置中复核。" : "在 Word 的布局 → 页边距中统一设置。" });
  }

  if (rules.bodyFont && inspection.fonts.length > 0) {
    if (fontMatches(inspection.fonts, rules.bodyFont)) passed.push(`检测到要求的正文字体：${rules.bodyFont}`);
    else add({ severity: "warning", category: "font", message: `未检测到要求的正文字体“${rules.bodyFont}”`, suggestion: `在原文中检查正文样式，并统一为 ${rules.bodyFont}。` });
  }
  if (rules.bodyFontSizePt > 0 && inspection.fontSizesPt.length > 0) {
    const matches = inspection.fontSizesPt.some((size) => Math.abs(size - rules.bodyFontSizePt) <= 0.6);
    if (matches) passed.push(`检测到 ${rules.bodyFontSizePt} pt 正文字号`);
    else add({ severity: "warning", category: "font", message: `常用字号中未检测到 ${rules.bodyFontSizePt} pt`, suggestion: "检查正文样式的字号；PDF 内嵌字体可能造成少量识别偏差。" });
  }

  if (rules.maxPages && inspection.pageCount && inspection.pageCount > rules.maxPages) add({ severity: "error", category: "page", message: `文档共 ${inspection.pageCount} 页，超过限制 ${rules.maxPages} 页`, suggestion: "按要求压缩正文或将允许的内容移至附录。" });
  else if (inspection.pageCount) passed.push(`已读取 ${inspection.pageCount} 页`);

  if (inspection.blankPages.length > 0) add({ severity: "warning", category: "page", message: `发现疑似空白页：第 ${inspection.blankPages.join("、")} 页`, location: `第 ${inspection.blankPages.join("、")} 页`, suggestion: "检查分页符、分节符或空段落，确认空白页是否必要。" });
  if (inspection.pageCount && inspection.pageCount > 1) {
    if (inspection.pageNumbers.length === 0) add({ severity: "warning", category: "page", message: "未检测到连续页码", suggestion: "检查页脚中的 PAGE 域或 PDF 页面底部页码。" });
    else {
      const missing = missingNumbers(inspection.pageNumbers);
      if (missing.length > 0) add({ severity: "warning", category: "page", message: `页码序列可能缺少：${missing.join("、")}`, suggestion: "检查分节后的页码是否重新起始或被隐藏。" });
      else passed.push("页码序列未发现明显断档");
    }
  }

  const missingFigures = missingNumbers(checkNumberSequence(inspection.text, /(?:图|Figure\s*)\s*(\d+)/gi));
  const missingTables = missingNumbers(checkNumberSequence(inspection.text, /(?:表|Table\s*)\s*(\d+)/gi));
  if (missingFigures.length > 0 || missingTables.length > 0) add({ severity: "warning", category: "figure", message: [missingFigures.length ? `图号缺少 ${missingFigures.join("、")}` : "", missingTables.length ? `表号缺少 ${missingTables.join("、")}` : ""].filter(Boolean).join("；"), suggestion: "核对图表题注、交叉引用和删除内容后留下的编号空缺。" });
  else passed.push("图表编号未发现明显断档");

  const headingNumbers = [...inspection.text.matchAll(/(?:^|\n)\s*(\d+)(?:\.\d+)*[\s、．.]\s*[^\d\n]{2,40}/gm)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  if (headingNumbers.length >= 2) {
    const missingHeadings = missingNumbers(headingNumbers);
    if (missingHeadings.length > 0) add({ severity: "warning", category: "heading", message: `一级标题编号可能缺少：${missingHeadings.join("、")}`, suggestion: "检查标题样式、多级列表和删除章节后留下的编号空缺。" });
    else passed.push("标题编号未发现明显断档");
  }

  if (rules.checkReferences) {
    const citations = checkNumberSequence(inspection.text, /\[(\d+)\]/g);
    const hasReferenceSection = /参考文献|references/i.test(inspection.text);
    if (citations.length > 0 && !hasReferenceSection) add({ severity: "error", category: "citation", message: "正文存在顺序编码引用，但未识别到参考文献章节", suggestion: "补充参考文献列表，或确认章节标题未被转换为图片。" });
    else if (hasReferenceSection) passed.push("已识别参考文献章节");
  }

  if (inspection.hasComments || inspection.hasRevisions) add({ severity: "error", category: "hidden", message: `${inspection.hasComments ? "存在批注" : ""}${inspection.hasComments && inspection.hasRevisions ? "，且" : ""}${inspection.hasRevisions ? "存在修订痕迹" : ""}`, suggestion: "提交前接受或拒绝全部修订并删除批注，再导出最终版本。" });
  else if (inspection.fileType === "docx") passed.push("未发现批注或修订痕迹");

  return { inspection, issues, passed, checkedAt: new Date().toISOString() };
}
