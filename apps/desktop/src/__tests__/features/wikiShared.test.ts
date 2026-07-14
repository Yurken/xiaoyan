import { describe, expect, it } from "vitest";
import { wikiMarkdownForDisplay } from "../../features/wiki/shared";

describe("Wiki display markdown", () => {
  it("converts wikilinks and source references into interactive markdown", () => {
    const result = wikiMarkdownForDisplay(
      "参见 [[graph-rag|图谱检索]]。[source:paper:paper-1]",
      [{
        id: "source-1",
        source_kind: "paper",
        source_id: "paper-1",
        source_title: "Graph RAG Paper",
        locator: "paper:paper-1",
        relation_kind: "supports",
        excerpt: "evidence",
      }],
    );
    expect(result).toContain("[图谱检索](#wiki:graph-rag)");
    expect(result).toContain("**来源：Graph RAG Paper**");
  });
});
