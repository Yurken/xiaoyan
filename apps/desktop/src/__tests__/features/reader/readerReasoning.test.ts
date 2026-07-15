import { describe, expect, it } from "vitest";
import { splitReasoning } from "../../../features/reader/readerReasoning";

describe("splitReasoning", () => {
  it("在思考标签尚未闭合时不返回思考内容", () => {
    expect(splitReasoning("<think>先分析术语").answer).toBe("");
  });

  it("只保留流式响应中的可展示正文", () => {
    expect(splitReasoning("<think>内部推理</think>这是译文。")).toEqual({
      thought: "内部推理",
      answer: "这是译文。",
    });
  });
});
