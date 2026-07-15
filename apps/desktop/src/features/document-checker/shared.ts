export type DocumentCheckSeverity = "error" | "warning" | "info";
export type DocumentCheckCategory = "page" | "font" | "heading" | "figure" | "citation" | "hidden";
export type DocumentComparisonStatus = "match" | "mismatch" | "unavailable";
export type DocumentRole = "reference" | "candidate";

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

export interface SelectedDocumentFile {
  path: string;
  name: string;
}

export interface DocumentCheckIssue {
  id: string;
  severity: DocumentCheckSeverity;
  category: DocumentCheckCategory;
  message: string;
  location?: string;
  suggestion: string;
  expected?: string;
  actual?: string;
  basis?: string;
}

export interface DocumentComparisonItem {
  id: string;
  category: DocumentCheckCategory;
  label: string;
  expected: string;
  actual: string;
  status: DocumentComparisonStatus;
  severity: DocumentCheckSeverity;
  basis: string;
  suggestion: string;
}

export interface DocumentReferenceProfile {
  pageWidthMm: number | null;
  pageHeightMm: number | null;
  marginsMm: DocumentInspection["marginsMm"];
  fonts: string[];
  fontSizePt: number | null;
  maxPages: number | null;
  pageBasis: string;
  marginBasis: string;
  fontBasis: string;
  fontSizeBasis: string;
}

export interface DocumentComparisonReport {
  reference: DocumentInspection;
  candidate: DocumentInspection;
  profile: DocumentReferenceProfile;
  comparisons: DocumentComparisonItem[];
  issues: DocumentCheckIssue[];
  passed: string[];
  checkedAt: string;
}

const CHINESE_FONT_SIZES: Record<string, number> = {
  初号: 42,
  小初: 36,
  一号: 26,
  小一: 24,
  二号: 22,
  小二: 18,
  三号: 16,
  小三: 15,
  四号: 14,
  小四: 12,
  五号: 10.5,
  小五: 9,
  六号: 7.5,
  小六: 6.5,
};

const KNOWN_FONTS = [
  "宋体",
  "黑体",
  "仿宋",
  "楷体",
  "微软雅黑",
  "方正小标宋",
  "Times New Roman",
  "Arial",
];

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeFontName(value: string) {
  return value.toLocaleLowerCase().replace(/[+\s_-]/g, "");
}

function fontMatches(actual: string[], expected: string) {
  const aliases: Record<string, string[]> = {
    宋体: ["宋体", "simsun", "songti", "stsong"],
    黑体: ["黑体", "simhei", "heiti", "stheiti"],
    仿宋: ["仿宋", "fangsong", "stfangsong"],
    楷体: ["楷体", "kaiti", "stkaiti"],
    timesnewroman: ["timesnewroman", "times", "liberationserif"],
  };
  const expectedName = normalizeFontName(expected);
  const candidates = aliases[expectedName] ?? [expectedName];
  return actual.some((font) => candidates.some((candidate) => normalizeFontName(font).includes(normalizeFontName(candidate))));
}

function parseMeasurement(value: string, unit: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return /cm|厘米/i.test(unit) ? amount * 10 : amount;
}

function explicitMargin(text: string, side: "top" | "right" | "bottom" | "left") {
  const labels = {
    top: "上",
    right: "右",
    bottom: "下",
    left: "左",
  } as const;
  const match = text.match(new RegExp(String.raw`${labels[side]}(?:页)?边距[^\d]{0,12}(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米)`, "i"));
  return match ? parseMeasurement(match[1], match[2]) : null;
}

function explicitUniformMargin(text: string) {
  const match = text.match(/(?<![上下左右])(?:四周|上下左右|页面)?\s*页?边距[^\d]{0,12}(\d+(?:\.\d+)?)\s*(mm|毫米|cm|厘米)/i);
  return match ? parseMeasurement(match[1], match[2]) : null;
}

function explicitBodyFonts(text: string) {
  const bodyContext = text.match(/(?:中文)?正文[^。；;\n]{0,80}/gi)?.join(" ") ?? "";
  return KNOWN_FONTS.filter((font) => bodyContext.toLocaleLowerCase().includes(font.toLocaleLowerCase()));
}

function explicitBodyFontSize(text: string) {
  const bodyContext = text.match(/(?:中文)?正文[^。；;\n]{0,80}/gi)?.join(" ") ?? "";
  const chineseSize = bodyContext.match(/小初|小[一二三四五六]|初号|[一二三四五六]号/)?.[0];
  if (chineseSize && chineseSize in CHINESE_FONT_SIZES) return CHINESE_FONT_SIZES[chineseSize];
  const pointMatch = bodyContext.match(/(\d+(?:\.\d+)?)\s*(?:pt|磅)/i);
  return pointMatch ? Number(pointMatch[1]) : null;
}

function explicitMaxPages(text: string) {
  const match = text.match(/(?:不超过|不得超过|最多|限于?|控制在)\s*(\d{1,4})\s*页/i);
  return match ? Number(match[1]) : null;
}

function inferredBodyFontSize(sizes: number[]) {
  const bodyCandidates = sizes.filter((size) => size >= 9 && size <= 14).sort((a, b) => a - b);
  if (bodyCandidates.length === 0) return null;
  return bodyCandidates[Math.floor(bodyCandidates.length / 2)];
}

export function deriveReferenceProfile(reference: DocumentInspection): DocumentReferenceProfile {
  const text = reference.text;
  const explicitA4 = /(?:^|\W)A4(?:\W|$)/i.test(text);
  const uniformMargin = explicitUniformMargin(text);
  const measuredMargins = reference.marginsMm;
  const marginValues = {
    top: explicitMargin(text, "top") ?? uniformMargin ?? measuredMargins?.top ?? null,
    right: explicitMargin(text, "right") ?? uniformMargin ?? measuredMargins?.right ?? null,
    bottom: explicitMargin(text, "bottom") ?? uniformMargin ?? measuredMargins?.bottom ?? null,
    left: explicitMargin(text, "left") ?? uniformMargin ?? measuredMargins?.left ?? null,
  };
  const marginsMm = Object.values(marginValues).every((value) => value !== null)
    ? marginValues as NonNullable<DocumentInspection["marginsMm"]>
    : null;
  const explicitFonts = explicitBodyFonts(text);
  const explicitSize = explicitBodyFontSize(text);

  return {
    pageWidthMm: explicitA4 ? 210 : reference.pageWidthMm,
    pageHeightMm: explicitA4 ? 297 : reference.pageHeightMm,
    marginsMm,
    fonts: explicitFonts.length > 0 ? explicitFonts : reference.fonts,
    fontSizePt: explicitSize ?? inferredBodyFontSize(reference.fontSizesPt),
    maxPages: explicitMaxPages(text),
    pageBasis: explicitA4 ? "规范文档明确要求" : "规范文档版式",
    marginBasis: uniformMargin !== null || (["top", "right", "bottom", "left"] as const).some((side) => explicitMargin(text, side) !== null)
      ? "规范文档明确要求"
      : "规范文档版式",
    fontBasis: explicitFonts.length > 0 ? "规范文档明确要求" : "规范文档使用字体",
    fontSizeBasis: explicitSize !== null ? "规范文档明确要求" : "规范文档常用字号",
  };
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

function unavailableComparison(
  id: string,
  category: DocumentCheckCategory,
  label: string,
  basis: string,
): DocumentComparisonItem {
  return {
    id,
    category,
    label,
    expected: "未识别",
    actual: "未识别",
    status: "unavailable",
    severity: "info",
    basis,
    suggestion: "请在原始排版软件中人工确认此项。",
  };
}

function buildLayoutComparisons(
  profile: DocumentReferenceProfile,
  candidate: DocumentInspection,
): DocumentComparisonItem[] {
  const comparisons: DocumentComparisonItem[] = [];

  if (profile.pageWidthMm !== null && profile.pageHeightMm !== null && candidate.pageWidthMm !== null && candidate.pageHeightMm !== null) {
    const direct = Math.abs(candidate.pageWidthMm - profile.pageWidthMm) <= 2
      && Math.abs(candidate.pageHeightMm - profile.pageHeightMm) <= 2;
    const rotated = Math.abs(candidate.pageWidthMm - profile.pageHeightMm) <= 2
      && Math.abs(candidate.pageHeightMm - profile.pageWidthMm) <= 2;
    comparisons.push({
      id: "comparison-page-size",
      category: "page",
      label: "纸张尺寸",
      expected: `${rounded(profile.pageWidthMm)} × ${rounded(profile.pageHeightMm)} mm`,
      actual: `${rounded(candidate.pageWidthMm)} × ${rounded(candidate.pageHeightMm)} mm`,
      status: direct || rotated ? "match" : "mismatch",
      severity: "error",
      basis: profile.pageBasis,
      suggestion: "在页面设置中统一纸张大小，并检查是否混入横向或其他尺寸页面。",
    });
  } else {
    comparisons.push(unavailableComparison("comparison-page-size", "page", "纸张尺寸", profile.pageBasis));
  }

  if (profile.marginsMm && candidate.marginsMm) {
    const labels = ["上", "右", "下", "左"];
    const expected = [profile.marginsMm.top, profile.marginsMm.right, profile.marginsMm.bottom, profile.marginsMm.left];
    const actual = [candidate.marginsMm.top, candidate.marginsMm.right, candidate.marginsMm.bottom, candidate.marginsMm.left];
    const matches = actual.every((value, index) => Math.abs(value - expected[index]) <= 3);
    comparisons.push({
      id: "comparison-margins",
      category: "page",
      label: "页边距",
      expected: expected.map((value, index) => `${labels[index]} ${rounded(value)}`).join(" / ") + " mm",
      actual: actual.map((value, index) => `${labels[index]} ${rounded(value)}`).join(" / ") + " mm",
      status: matches ? "match" : "mismatch",
      severity: "warning",
      basis: profile.marginBasis,
      suggestion: candidate.fileType === "pdf" ? "PDF 页边距按正文边界估算，请回到 Word/LaTeX 页面设置中复核。" : "在 Word 的布局 → 页边距中按规范文档统一设置。",
    });
  } else {
    comparisons.push(unavailableComparison("comparison-margins", "page", "页边距", profile.marginBasis));
  }

  if (profile.fonts.length > 0 && candidate.fonts.length > 0) {
    const matches = profile.fonts.some((font) => fontMatches(candidate.fonts, font));
    comparisons.push({
      id: "comparison-fonts",
      category: "font",
      label: "正文字体",
      expected: profile.fonts.slice(0, 5).join("、"),
      actual: candidate.fonts.slice(0, 5).join("、"),
      status: matches ? "match" : "mismatch",
      severity: "warning",
      basis: profile.fontBasis,
      suggestion: "检查成稿的正文样式，并统一为规范文档要求或模板实际使用的字体。",
    });
  } else {
    comparisons.push(unavailableComparison("comparison-fonts", "font", "正文字体", profile.fontBasis));
  }

  const expectedFontSize = profile.fontSizePt;
  if (expectedFontSize !== null && candidate.fontSizesPt.length > 0) {
    const matches = candidate.fontSizesPt.some((size) => Math.abs(size - expectedFontSize) <= 0.6);
    comparisons.push({
      id: "comparison-font-size",
      category: "font",
      label: "正文字号",
      expected: `${rounded(expectedFontSize)} pt`,
      actual: candidate.fontSizesPt.slice(0, 8).map((size) => `${rounded(size)} pt`).join("、"),
      status: matches ? "match" : "mismatch",
      severity: "warning",
      basis: profile.fontSizeBasis,
      suggestion: "检查成稿正文样式的字号；PDF 内嵌字体可能造成少量识别偏差。",
    });
  } else {
    comparisons.push(unavailableComparison("comparison-font-size", "font", "正文字号", profile.fontSizeBasis));
  }

  if (profile.maxPages !== null) {
    const pageCount = candidate.pageCount;
    comparisons.push({
      id: "comparison-page-limit",
      category: "page",
      label: "页数上限",
      expected: `不超过 ${profile.maxPages} 页`,
      actual: pageCount === null ? "未识别" : `${pageCount} 页`,
      status: pageCount === null ? "unavailable" : pageCount <= profile.maxPages ? "match" : "mismatch",
      severity: "error",
      basis: "规范文档明确要求",
      suggestion: "按规范压缩正文，或将允许的内容移至附录。",
    });
  }

  return comparisons;
}

function issueFromComparison(item: DocumentComparisonItem): DocumentCheckIssue {
  return {
    id: item.id,
    severity: item.severity,
    category: item.category,
    message: `${item.label}与规范文档不一致`,
    suggestion: item.suggestion,
    expected: item.expected,
    actual: item.actual,
    basis: item.basis,
  };
}

function evaluateCandidate(candidate: DocumentInspection) {
  const issues: DocumentCheckIssue[] = [];
  const passed: string[] = [];
  const add = (issue: Omit<DocumentCheckIssue, "id">) => issues.push({ id: `candidate-${issue.category}-${issues.length + 1}`, ...issue });

  if (candidate.blankPages.length > 0) {
    add({ severity: "warning", category: "page", message: `发现疑似空白页：第 ${candidate.blankPages.join("、")} 页`, location: `第 ${candidate.blankPages.join("、")} 页`, suggestion: "检查分页符、分节符或空段落，确认空白页是否必要。" });
  }
  if (candidate.pageCount && candidate.pageCount > 1) {
    if (candidate.pageNumbers.length === 0) {
      add({ severity: "warning", category: "page", message: "未检测到连续页码", suggestion: "检查页脚中的 PAGE 域或 PDF 页面底部页码。" });
    } else {
      const missing = missingNumbers(candidate.pageNumbers);
      if (missing.length > 0) add({ severity: "warning", category: "page", message: `页码序列可能缺少：${missing.join("、")}`, suggestion: "检查分节后的页码是否重新起始或被隐藏。" });
      else passed.push("页码序列未发现明显断档");
    }
  }

  const missingFigures = missingNumbers(checkNumberSequence(candidate.text, /(?:图|Figure\s*)\s*(\d+)/gi));
  const missingTables = missingNumbers(checkNumberSequence(candidate.text, /(?:表|Table\s*)\s*(\d+)/gi));
  if (missingFigures.length > 0 || missingTables.length > 0) {
    add({ severity: "warning", category: "figure", message: [missingFigures.length ? `图号缺少 ${missingFigures.join("、")}` : "", missingTables.length ? `表号缺少 ${missingTables.join("、")}` : ""].filter(Boolean).join("；"), suggestion: "核对图表题注、交叉引用和删除内容后留下的编号空缺。" });
  } else {
    passed.push("图表编号未发现明显断档");
  }

  const headingNumbers = [...candidate.text.matchAll(/(?:^|\n)\s*(\d+)(?:\.\d+)*[\s、．.]\s*[^\d\n]{2,40}/gm)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  if (headingNumbers.length >= 2) {
    const missingHeadings = missingNumbers(headingNumbers);
    if (missingHeadings.length > 0) add({ severity: "warning", category: "heading", message: `一级标题编号可能缺少：${missingHeadings.join("、")}`, suggestion: "检查标题样式、多级列表和删除章节后留下的编号空缺。" });
    else passed.push("标题编号未发现明显断档");
  }

  const citations = checkNumberSequence(candidate.text, /\[(\d+)\]/g);
  const hasReferenceSection = /参考文献|references/i.test(candidate.text);
  if (citations.length > 0 && !hasReferenceSection) {
    add({ severity: "error", category: "citation", message: "正文存在顺序编码引用，但未识别到参考文献章节", suggestion: "补充参考文献列表，或确认章节标题未被转换为图片。" });
  } else if (hasReferenceSection) {
    passed.push("已识别参考文献章节");
  }

  if (candidate.hasComments || candidate.hasRevisions) {
    add({ severity: "error", category: "hidden", message: `${candidate.hasComments ? "存在批注" : ""}${candidate.hasComments && candidate.hasRevisions ? "，且" : ""}${candidate.hasRevisions ? "存在修订痕迹" : ""}`, suggestion: "提交前接受或拒绝全部修订并删除批注，再导出最终版本。" });
  } else if (candidate.fileType === "docx") {
    passed.push("未发现批注或修订痕迹");
  }

  return { issues, passed };
}

export function compareDocuments(
  reference: DocumentInspection,
  candidate: DocumentInspection,
): DocumentComparisonReport {
  const profile = deriveReferenceProfile(reference);
  const comparisons = buildLayoutComparisons(profile, candidate);
  const candidateResult = evaluateCandidate(candidate);
  const mismatches = comparisons.filter((item) => item.status === "mismatch").map(issueFromComparison);
  const matched = comparisons.filter((item) => item.status === "match").map((item) => `${item.label}与规范文档一致`);

  return {
    reference,
    candidate,
    profile,
    comparisons,
    issues: [...mismatches, ...candidateResult.issues],
    passed: [...matched, ...candidateResult.passed],
    checkedAt: new Date().toISOString(),
  };
}
