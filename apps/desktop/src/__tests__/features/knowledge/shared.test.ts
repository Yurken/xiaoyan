import { describe, expect, it } from "vitest";
import { buildSurveyMarkdownPreview, dedupeSurveyCitations } from "../../../features/knowledge/shared";

describe("knowledge/shared survey helpers", () => {
  it("buildSurveyMarkdownPreview 应隐藏候选论文与参考文献附录", () => {
    const markdown = `# 文献综述

## 研究背景

这里是正文。

## 检索到的候选论文

1. Paper A

## 参考文献

[1] Paper A`;

    expect(buildSurveyMarkdownPreview(markdown)).toEqual({
      content: "# 文献综述\n\n## 研究背景\n\n这里是正文。",
      appendixHidden: true,
    });
  });

  it("dedupeSurveyCitations 应保持顺序并去除重复项", () => {
    expect(dedupeSurveyCitations(["[1] A", " [1] A ", "", "[2] B"])).toEqual(["[1] A", "[2] B"]);
  });

  it("dedupeSurveyCitations 应跳过非字符串元素", () => {
    expect(
      dedupeSurveyCitations(["[1] A", null as unknown as string, undefined as unknown as string, 42 as unknown as string, "[2] B"]),
    ).toEqual(["[1] A", "[2] B"]);
  });
});
