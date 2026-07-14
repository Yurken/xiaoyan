import { describe, expect, it } from "vitest";
import { evaluateDocument, getDocumentTemplate, type DocumentInspection } from "../../features/document-checker/shared";

const inspection: DocumentInspection = {
  fileName: "论文.docx",
  fileType: "docx",
  pageCount: 8,
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginsMm: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
  fonts: ["宋体", "Times New Roman"],
  fontSizesPt: [10.5, 12, 16],
  text: "图 1 方法框架\n图 3 实验结果\n正文引用 [1]\n参考文献\n[1] 示例文献",
  pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
  blankPages: [],
  hasComments: false,
  hasRevisions: false,
};

describe("文档校验规则", () => {
  it("生成通过项并发现图号断档", () => {
    const report = evaluateDocument(inspection, getDocumentTemplate("cn-thesis").rules);
    expect(report.passed).toContain("页边距在允许误差范围内");
    expect(report.issues.some((issue) => issue.category === "figure" && issue.message.includes("2"))).toBe(true);
  });

  it("发现批注和修订痕迹时给出严重问题", () => {
    const report = evaluateDocument({ ...inspection, hasComments: true, hasRevisions: true }, getDocumentTemplate("nsfc").rules);
    expect(report.issues.some((issue) => issue.category === "hidden" && issue.severity === "error")).toBe(true);
  });

  it("纸张尺寸错误应判定为严重问题", () => {
    const report = evaluateDocument({ ...inspection, pageWidthMm: 215.9, pageHeightMm: 279.4 }, getDocumentTemplate("cn-thesis").rules);
    expect(report.issues.some((issue) => issue.category === "page" && issue.severity === "error")).toBe(true);
  });
});
