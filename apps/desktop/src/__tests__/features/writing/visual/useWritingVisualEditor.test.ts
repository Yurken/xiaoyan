import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import { useWritingVisualEditor } from "../../../../features/writing/visual/useWritingVisualEditor";
import { parseLatexVisualDocument } from "../../../../features/writing/visual/latexVisualParser";
import { serializeLatexVisualDocument } from "../../../../features/writing/visual/latexVisualSerializer";
import { WRITING_TEMPLATES } from "../../../../features/writing/templates";

function options(source: string, onSourceChange = vi.fn()) {
  return {
    documentId: "draft-1:main",
    source,
    mainDocument: true,
    onSourceChange,
    onEditSource: vi.fn(),
  };
}

function selectText(editor: Editor, text: string) {
  let found = false;
  editor.state.doc.descendants((node, pos) => {
    if (found || !node.isText || node.text !== text) return;
    editor.chain().setTextSelection({ from: pos, to: pos + node.nodeSize }).run();
    found = true;
  });
  expect(found).toBe(true);
}

describe("可视化编辑器与 LaTeX 同步", () => {
  it("TipTap schema 保留源码属性，完整模板仍可逐字往返", () => {
    const source = WRITING_TEMPLATES[0].mainTex;
    const model = parseLatexVisualDocument(source, { mainDocument: true });
    const { result } = renderHook(() => useWritingVisualEditor(options(source)));
    expect(serializeLatexVisualDocument(model, result.current.editor.getJSON()).source).toBe(source);
  });

  it("标题级别和粗体操作会生成对应 LaTeX", () => {
    const source = String.raw`\documentclass{article}
\begin{document}
\section{Intro}
正文。
\end{document}`;
    const onSourceChange = vi.fn();
    const { result } = renderHook(() => useWritingVisualEditor(options(source, onSourceChange)));
    act(() => {
      selectText(result.current.editor, "Intro");
      result.current.editor.chain().toggleHeading({ level: 2 }).toggleBold().run();
    });
    const generated = onSourceChange.mock.calls.at(-1)?.[0] as string;
    expect(generated).toContain("\\subsection{\\textbf{Intro}}");
    expect(generated).toContain("正文。");
  });

  it("列表类型切换会替换环境而不是只改变外观", () => {
    const source = String.raw`\begin{itemize}
\item First
\item Second
\end{itemize}`;
    const onSourceChange = vi.fn();
    const { result } = renderHook(() => useWritingVisualEditor(options(source, onSourceChange)));
    act(() => {
      selectText(result.current.editor, "First");
      result.current.editor.chain().toggleOrderedList().run();
    });
    const generated = onSourceChange.mock.calls.at(-1)?.[0] as string;
    expect(generated).toContain("\\begin{enumerate}");
    expect(generated).toContain("\\end{enumerate}");
    expect(generated).toContain("\\item First");
    expect(generated).toContain("\\item Second");
  });

  it("外部源码变化才重建内容，不向父层回写", () => {
    const initial = "第一段";
    const onSourceChange = vi.fn();
    const { result, rerender } = renderHook((props) => useWritingVisualEditor(props), {
      initialProps: options(initial, onSourceChange),
    });
    act(() => {
      rerender(options("外部修改后的第二段", onSourceChange));
    });
    expect(result.current.editor.getText()).toContain("外部修改后的第二段");
    expect(onSourceChange).not.toHaveBeenCalled();
  });

  it("公式更新保留原环境和 label", () => {
    const source = String.raw`\begin{equation}
x=1
\label{eq:test}
\end{equation}`;
    const onSourceChange = vi.fn();
    const { result } = renderHook(() => useWritingVisualEditor(options(source, onSourceChange)));
    let pos = -1;
    result.current.editor.state.doc.descendants((node, nodePos) => {
      if (node.type.name === "blockMath") pos = nodePos;
    });
    act(() => result.current.setActiveMath({ kind: "blockMath", pos }));
    act(() => result.current.updateMath("y = x^2"));
    const generated = onSourceChange.mock.calls.at(-1)?.[0] as string;
    expect(generated).toContain("y = x^2");
    expect(generated).toContain("\\label{eq:test}");
    expect(generated).toContain("\\end{equation}");
  });

  it("插入引用生成 cite 节点而不是纯文本", () => {
    const onSourceChange = vi.fn();
    const { result } = renderHook(() => useWritingVisualEditor(options("正文。", onSourceChange)));
    act(() => result.current.applyCitation(["vaswani2017attention"]));
    const generated = onSourceChange.mock.calls.at(-1)?.[0] as string;
    expect(generated).toContain("\\cite{vaswani2017attention}");
    expect(result.current.editor.getJSON().content?.some((node) => JSON.stringify(node).includes('"citation"'))).toBe(true);
  });
});
