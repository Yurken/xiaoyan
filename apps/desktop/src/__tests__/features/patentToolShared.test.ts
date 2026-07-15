import { describe, expect, it } from "vitest";
import { buildPatentSearchPlan, buildPatentabilityReport, rankPatentResults } from "../../features/patent-tool/shared";

describe("专利检索共享逻辑", () => {
  it("根据显式技术特征生成布尔检索式", () => {
    const plan = buildPatentSearchPlan("一种缺陷检测方法", "多尺度特征融合，在线蒸馏");
    expect(plan.features).toEqual(["多尺度特征融合", "在线蒸馏"]);
    expect(plan.booleanQuery).toContain("AND");
    expect(plan.webQuery).toContain("site:patents.google.com/patent/CN");
  });

  it("按特征重叠度排序并识别中国公开号", () => {
    const plan = buildPatentSearchPlan("测试方案", "多尺度特征融合，在线蒸馏");
    const results = rankPatentResults([
      { title: "普通检测", url: "https://example.com", snippet: "检测方法" },
      { title: "CN115123456A 多尺度特征融合", url: "https://patents.google.com/patent/CN115123456A", snippet: "结合在线蒸馏" },
    ], plan);
    expect(results[0].publicationNumber).toBe("CN115123456A");
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
  });

  it("公开披露应标记为高风险", () => {
    const report = buildPatentabilityReport([], "public");
    expect(report.disclosureRisk).toBe("high");
    expect(report.noveltyRisk).toBe("unknown");
  });
});
