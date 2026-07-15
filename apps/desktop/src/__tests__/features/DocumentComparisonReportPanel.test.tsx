import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentComparisonReportPanel } from "../../features/document-checker/DocumentComparisonReportPanel";
import { compareDocuments, type DocumentInspection } from "../../features/document-checker/shared";

const reference: DocumentInspection = {
  fileName: "规范.docx",
  fileType: "docx",
  pageCount: 2,
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginsMm: { top: 25, right: 25, bottom: 25, left: 25 },
  fonts: ["宋体"],
  fontSizesPt: [12],
  text: "A4，正文使用宋体小四",
  pageNumbers: [1, 2],
  blankPages: [],
  hasComments: false,
  hasRevisions: false,
};

const candidate: DocumentInspection = {
  ...reference,
  fileName: "成稿.pdf",
  fileType: "pdf",
  pageCount: 6,
  pageWidthMm: 215.9,
  pageHeightMm: 279.4,
  pageNumbers: [1, 2, 3, 4, 5, 6],
};

describe("DocumentComparisonReportPanel", () => {
  it("并列展示规范值、成稿值和差异问题", () => {
    render(<DocumentComparisonReportPanel report={compareDocuments(reference, candidate)} />);

    expect(screen.getByText("规范比对结果")).toBeInTheDocument();
    expect(screen.getByText("成稿问题清单")).toBeInTheDocument();
    const pageSizeRow = screen.getByText("纸张尺寸").closest("article");
    if (!pageSizeRow) throw new Error("未找到纸张尺寸比对项");
    expect(within(pageSizeRow).getByText("210 × 297 mm")).toBeInTheDocument();
    expect(within(pageSizeRow).getByText("215.9 × 279.4 mm")).toBeInTheDocument();
    expect(screen.getByText("纸张尺寸与规范文档不一致")).toBeInTheDocument();
  });
});
