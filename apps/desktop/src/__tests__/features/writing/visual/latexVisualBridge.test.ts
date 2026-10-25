import { describe, expect, it } from "vitest";
import { WRITING_TEMPLATES } from "../../../../features/writing/templates";
import { parseLatexVisualDocument } from "../../../../features/writing/visual/latexVisualParser";
import { serializeLatexVisualDocument } from "../../../../features/writing/visual/latexVisualSerializer";
import type { VisualDocumentModel, VisualNode } from "../../../../features/writing/visual/latexVisualTypes";

function documentOf(model: VisualDocumentModel): VisualNode {
  return { type: "doc", content: model.content };
}

function findNode(nodes: VisualNode[], type: string): VisualNode | null {
  for (const node of nodes) {
    if (node.type === type) return node;
    const child = findNode(node.content ?? [], type);
    if (child) return child;
  }
  return null;
}

function editFirstText(model: VisualDocumentModel, type: string, value: string) {
  const editable = structuredClone(model);
  const node = findNode(editable.content, type);
  const text = node && findNode(node.content ?? [], "text");
  if (!text) throw new Error(`Missing editable text in ${type}`);
  text.text = value;
  return serializeLatexVisualDocument(editable, documentOf(editable)).source;
}

describe("LaTeX 可视化无损桥接", () => {
  it.each(WRITING_TEMPLATES.map((template) => [template.id, template.mainTex] as const))(
    "%s 模板未编辑时逐字往返",
    (_id, source) => {
      const model = parseLatexVisualDocument(source, { mainDocument: true });
      expect(model.readOnly).toBe(false);
      expect(serializeLatexVisualDocument(model, documentOf(model)).source).toBe(source);
    },
  );

  it("只改写标题，保留前言、正文和复杂表格", () => {
    const source = WRITING_TEMPLATES[0].mainTex;
    const model = parseLatexVisualDocument(source, { mainDocument: true });
    const result = editFirstText(model, "paperTitle", "直接编辑后的论文标题");
    expect(result).toContain("\\title{直接编辑后的论文标题}");
    expect(result).toContain("\\documentclass[UTF8,a4paper,11pt]{ctexart}");
    expect(result).toContain("\\section{引言}");
    expect(result).toContain("\\begin{tabular}{lcc}");
    expect(result).toContain("\\bibliographystyle{plainnat}");
  });

  it("保留列表环境并只更新被编辑的列表项", () => {
    const source = WRITING_TEMPLATES[0].mainTex;
    const model = parseLatexVisualDocument(source, { mainDocument: true });
    const list = findNode(model.content, "bulletList");
    const item = list?.content?.[0];
    const text = item && findNode(item.content ?? [], "text");
    if (!text) throw new Error("Missing list text");
    const editable = structuredClone(model);
    const editableList = findNode(editable.content, "bulletList");
    const editableText = editableList?.content?.[0] && findNode(editableList.content[0].content ?? [], "text");
    if (!editableText) throw new Error("Missing cloned list text");
    editableText.text = "更新第一项";
    const result = serializeLatexVisualDocument(editable, documentOf(editable)).source;
    expect(result).toContain("\\item 更新第一项");
    expect(result).toContain("\\begin{itemize}");
    expect(result).toContain("\\item 在多个任务上验证方法的有效性；");
  });

  it("修改独立公式时保留 label", () => {
    const model = parseLatexVisualDocument(WRITING_TEMPLATES[0].mainTex, { mainDocument: true });
    const editable = structuredClone(model);
    const math = findNode(editable.content, "blockMath");
    if (!math?.attrs) throw new Error("Missing block math");
    math.attrs.latex = "y = x^2";
    const result = serializeLatexVisualDocument(editable, documentOf(editable)).source;
    expect(result).toContain("y = x^2");
    expect(result).toContain("\\label{eq:objective}");
    expect(result).toContain("\\end{equation}");
  });

  it("普通文本会转义，未知宏不丢失", () => {
    const source = String.raw`\documentclass{article}
\newcommand{\custom}[1]{#1}
\begin{document}
\section{Test}
第一段 \custom[keep]{value}。
\end{document}
`;
    const model = parseLatexVisualDocument(source, { mainDocument: true });
    const result = editFirstText(model, "paragraph", "比例 50% & #1");
    expect(result).toContain("比例 50\\% \\& \\#1");
    expect(result).toContain("\\custom[keep]{value}");
    expect(result).toContain("\\newcommand{\\custom}[1]{#1}");
  });

  it("引用键可编辑且原始引用在未修改时保留", () => {
    const model = parseLatexVisualDocument(WRITING_TEMPLATES[0].mainTex, { mainDocument: true });
    expect(serializeLatexVisualDocument(model, documentOf(model)).source).toContain("\\cite{vaswani2017attention}");
    const editable = structuredClone(model);
    const citation = findNode(editable.content, "citation");
    if (!citation?.attrs) throw new Error("Missing citation");
    citation.attrs.keys = ["new-key"];
    const result = serializeLatexVisualDocument(editable, documentOf(editable)).source;
    expect(result).toContain("\\cite{new-key}");
  });

  it("只读模型绝不回写降级内容", () => {
    const source = "\\unknown{保留全部源码}";
    const model = parseLatexVisualDocument(source);
    const readOnly = { ...model, readOnly: true };
    const changed = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "覆盖" }] }] };
    expect(serializeLatexVisualDocument(readOnly, changed).source).toBe(source);
  });
});
