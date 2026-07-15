import { describe, expect, it } from "vitest";
import {
  compareDocuments,
  deriveReferenceProfile,
  type DocumentInspection,
} from "../../features/document-checker/shared";

const reference: DocumentInspection = {
  fileName: "投稿规范.docx",
  fileType: "docx",
  pageCount: 4,
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginsMm: { top: 30, right: 30, bottom: 30, left: 30 },
  fonts: ["黑体", "宋体"],
  fontSizesPt: [10.5, 12, 16],
  text: "文稿采用 A4 纸。页边距均为 2.5 cm，正文使用宋体小四号。全文不得超过 10 页。",
  pageNumbers: [1, 2, 3, 4],
  blankPages: [],
  hasComments: false,
  hasRevisions: false,
};

const candidate: DocumentInspection = {
  fileName: "论文成稿.docx",
  fileType: "docx",
  pageCount: 8,
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginsMm: { top: 25, right: 25, bottom: 25, left: 25 },
  fonts: ["宋体", "Times New Roman"],
  fontSizesPt: [10.5, 12, 16],
  text: "图 1 方法框架\n图 2 实验结果\n正文引用 [1]\n参考文献\n[1] 示例文献",
  pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
  blankPages: [],
  hasComments: false,
  hasRevisions: false,
};

describe("规范文档与成稿比对", () => {
  it("从规范正文提取明确的页面、字体和页数要求", () => {
    const profile = deriveReferenceProfile(reference);

    expect(profile.pageWidthMm).toBe(210);
    expect(profile.pageHeightMm).toBe(297);
    expect(profile.marginsMm).toEqual({ top: 25, right: 25, bottom: 25, left: 25 });
    expect(profile.fonts).toEqual(["宋体"]);
    expect(profile.fontSizePt).toBe(12);
    expect(profile.maxPages).toBe(10);
    expect(profile.marginBasis).toBe("规范文档明确要求");
  });

  it("两份文档格式一致时生成逐项通过结果", () => {
    const report = compareDocuments(reference, candidate);

    expect(report.comparisons).toHaveLength(5);
    expect(report.comparisons.every((item) => item.status === "match")).toBe(true);
    expect(report.passed).toContain("纸张尺寸与规范文档一致");
    expect(report.issues.some((issue) => issue.id.startsWith("comparison-"))).toBe(false);
  });

  it("把纸张、页边距、字体、字号和页数差异列入问题清单", () => {
    const report = compareDocuments(reference, {
      ...candidate,
      pageCount: 12,
      pageWidthMm: 215.9,
      pageHeightMm: 279.4,
      marginsMm: { top: 15, right: 15, bottom: 15, left: 15 },
      fonts: ["Arial"],
      fontSizesPt: [10],
    });

    expect(report.comparisons.filter((item) => item.status === "mismatch")).toHaveLength(5);
    expect(report.issues.find((issue) => issue.id === "comparison-page-size")).toMatchObject({
      severity: "error",
      expected: "210 × 297 mm",
      actual: "215.9 × 279.4 mm",
    });
    expect(report.issues.some((issue) => issue.id === "comparison-page-limit")).toBe(true);
  });

  it("比对格式之外仍检查成稿的编号与修订残留", () => {
    const report = compareDocuments(reference, {
      ...candidate,
      text: "图 1 方法框架\n图 3 实验结果",
      hasComments: true,
      hasRevisions: true,
    });

    expect(report.issues.some((issue) => issue.category === "figure" && issue.message.includes("2"))).toBe(true);
    expect(report.issues.some((issue) => issue.category === "hidden" && issue.severity === "error")).toBe(true);
  });

  it("规范正文没有明确要求时回退到规范文档自身版式", () => {
    const profile = deriveReferenceProfile({ ...reference, text: "投稿说明" });

    expect(profile.marginsMm).toEqual(reference.marginsMm);
    expect(profile.fonts).toEqual(reference.fonts);
    expect(profile.marginBasis).toBe("规范文档版式");
    expect(profile.fontBasis).toBe("规范文档使用字体");
  });

  it("分别提取规范中的四边页边距", () => {
    const profile = deriveReferenceProfile({
      ...reference,
      text: "上边距 2 cm，下边距 3 cm，左边距 2.5 cm，右边距 2.5 cm。",
    });

    expect(profile.marginsMm).toEqual({ top: 20, right: 25, bottom: 30, left: 25 });
    expect(profile.marginBasis).toBe("规范文档明确要求");
  });
});
