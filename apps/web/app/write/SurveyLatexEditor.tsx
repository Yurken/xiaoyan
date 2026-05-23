"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Eraser,
  FileText,
  PenLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import katex from "katex";

const DEFAULT_TEMPLATE = `\\section{Introduction}
Large language models (LLMs) have achieved remarkable success in various natural language processing tasks. The core idea can be formulated as:
$$\\mathcal{P}(y \\mid x) = \\prod_{t=1}^{T} \\mathcal{P}(y_t \\mid y_{<t}, x; \\theta)$$
where $\\theta$ denotes the model parameters and $T$ is the sequence length.

\\section{Related Work}
\\subsection{Transformer Architecture}
The self-attention mechanism computes scaled dot-product attention:
$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$
Here $d_k$ is the dimension of the key vectors.

\\section{Methodology}
Our proposed approach optimizes the following objective:
$$\\mathcal{L}(\\theta) = \\mathbb{E}_{(x,y) \\sim \\mathcal{D}} [ -\\log \\mathcal{P}_\\theta(y \\mid x) ] + \\lambda \\|\\theta\\|_2^2$$
where $\\lambda > 0$ is the regularization coefficient.

\\section{Experiments}
We evaluate our method on standard benchmarks. The results demonstrate significant improvements over baseline approaches.

\\section{Conclusion}
In this paper, we presented a novel approach for ...`;

const SNIPPETS = [
  { label: "分数", code: "\\frac{a}{b}" },
  { label: "上标", code: "x^{2}" },
  { label: "下标", code: "x_{i}" },
  { label: "求和", code: "\\sum_{i=1}^{n} x_i" },
  { label: "积分", code: "\\int_{0}^{\\infty} f(x) \\, dx" },
  { label: "极限", code: "\\lim_{n \\to \\infty} a_n" },
  { label: "矩阵", code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "偏导", code: "\\frac{\\partial f}{\\partial x}" },
  { label: "范数", code: "\\|x\\|_2" },
  { label: "集合", code: "\\{ x \\in \\mathbb{R}^n \\mid \\|x\\| \\leq 1 \\}" },
];

function LatexPreview({ source }: { source: string }) {
  const renderLatex = useCallback((content: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(content, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span style="color:#dc2626">${content}</span>`;
    }
  }, []);

  const html = useMemo(() => {
    const segments: Array<{ type: "text" | "block" | "inline"; content: string }> = [];
    const blockRegex = /\$\$([\s\S]*?)\$\$/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(source)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", content: source.slice(lastIndex, match.index) });
      }
      segments.push({ type: "block", content: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < source.length) {
      segments.push({ type: "text", content: source.slice(lastIndex) });
    }

    const finalSegments: Array<{ type: "text" | "block" | "inline"; content: string }> = [];
    for (const seg of segments) {
      if (seg.type !== "text") {
        finalSegments.push(seg);
        continue;
      }
      const inlineRegex = /\$([\s\S]*?)\$/g;
      let inlineLast = 0;
      let inlineMatch: RegExpExecArray | null;
      while ((inlineMatch = inlineRegex.exec(seg.content)) !== null) {
        if (inlineMatch.index > inlineLast) {
          finalSegments.push({ type: "text", content: seg.content.slice(inlineLast, inlineMatch.index) });
        }
        finalSegments.push({ type: "inline", content: inlineMatch[1].trim() });
        inlineLast = inlineMatch.index + inlineMatch[0].length;
      }
      if (inlineLast < seg.content.length) {
        finalSegments.push({ type: "text", content: seg.content.slice(inlineLast) });
      }
    }

    return finalSegments;
  }, [source]);

  return (
    <div className="h-full overflow-y-auto p-4 text-sm leading-7 text-gray-700">
      {html.map((seg, idx) => {
        if (seg.type === "block") {
          return (
            <div
              key={idx}
              className="my-4 flex justify-center overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4"
              dangerouslySetInnerHTML={{ __html: renderLatex(seg.content, true) }}
            />
          );
        }
        if (seg.type === "inline") {
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: renderLatex(seg.content, false) }}
            />
          );
        }
        return (
          <span key={idx}>
            {seg.content.split("\n").map((line, lineIdx, arr) => {
              const isHeading = line.match(/^\\(section|subsection|subsubsection)\{(.*)\}$/);
              if (isHeading) {
                const level = isHeading[1];
                const text = isHeading[2];
                const headingClass =
                  level === "section"
                    ? "text-lg font-bold text-gray-900 mt-5 mb-2"
                    : level === "subsection"
                      ? "text-base font-semibold text-gray-900 mt-4 mb-1.5"
                      : "text-sm font-semibold text-gray-900 mt-3 mb-1";
                return (
                  <div key={lineIdx} className={headingClass}>
                    {text}
                  </div>
                );
              }

              const trimmed = line.trim();
              if (trimmed.startsWith("\\begin{") || trimmed.startsWith("\\end{")) {
                return null;
              }
              if (trimmed === "" && lineIdx < arr.length - 1) {
                return <div key={lineIdx} className="h-2" />;
              }
              if (trimmed === "") return null;
              return (
                <p key={lineIdx} className="my-1">
                  {line}
                </p>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

export default function SurveyLatexEditor() {
  const [source, setSource] = usePersistentLatexState("rc:survey:latex:source", DEFAULT_TEMPLATE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = useCallback(
    (code: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = source.slice(0, start);
      const after = source.slice(end);
      const inserted = `${before}$${code}$${after}`;
      setSource(inserted);
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + 1 + code.length + 1;
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [source, setSource]
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(source);
  }, [source]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([source], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "survey.tex";
    a.click();
    URL.revokeObjectURL(url);
  }, [source]);

  const handleReset = useCallback(() => {
    setSource(DEFAULT_TEMPLATE);
  }, [setSource]);

  const handleClear = useCallback(() => {
    setSource("");
  }, [setSource]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <PenLine className="h-4 w-4 text-brand-600" />
            LaTeX 学术写作编辑器
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />
              复制源码
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              下载 .tex
            </Button>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              重置模板
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClear}>
              <Eraser className="h-3.5 w-3.5" />
              清空
            </Button>
          </div>
        </div>

        {/* Snippets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-gray-500">快速插入：</span>
          {SNIPPETS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => handleInsert(s.code)}
              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-600"
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Editor + Preview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex min-h-[360px] flex-col overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
            <FileText className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">源码编辑</span>
          </div>
          <textarea
            ref={textareaRef}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="flex-1 resize-none bg-transparent p-4 font-mono text-[13px] leading-6 text-gray-900 outline-none"
            spellCheck={false}
            placeholder="在此输入 LaTeX 源码，使用 $...$ 插入行内公式，$$...$$ 插入块级公式..."
          />
        </Card>

        <Card className="flex min-h-[360px] flex-col overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
            <Sparkles className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">文稿预览</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <LatexPreview source={source} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function usePersistentLatexState(key: string, fallback: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ?? fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }, [key, value]);

  return [value, setValue] as const;
}
