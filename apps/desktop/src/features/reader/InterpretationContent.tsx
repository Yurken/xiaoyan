import { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";
import { openLink } from "../../lib/links";
import { splitReasoning } from "./readerReasoning";

interface InterpretationContentProps {
  text: string;
  loading: boolean;
}

/** 解读正文：Markdown 渲染，<think> 思考过程默认折叠进「思考」按钮。 */
export default function InterpretationContent({ text, loading }: InterpretationContentProps) {
  const [showThought, setShowThought] = useState(false);
  const { thought, answer } = splitReasoning(text);
  const thinking = loading && !answer; // 仍在思考阶段（正文还没开始）

  return (
    <div className="space-y-1.5">
      {thought ? (
        <div>
          <button
            type="button"
            onClick={() => setShowThought((value) => !value)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-tertiary transition-colors hover:text-ink-secondary"
          >
            <Brain className="h-3 w-3" />
            {thinking ? "思考中…" : "思考过程"}
            <ChevronDown
              className="h-3 w-3 transition-transform"
              style={{ transform: showThought ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
          {showThought ? (
            <div
              className="mt-1 whitespace-pre-wrap rounded-lg px-2.5 py-2 text-[11px] leading-5 text-ink-secondary"
              style={{ background: "var(--rc-card-inset-bg)" }}
            >
              {thought}
            </div>
          ) : null}
        </div>
      ) : null}

      {answer ? (
        <MarkdownRenderer
          content={answer}
          onLinkClick={openLink}
          className="text-xs leading-6 text-ink-primary prose-p:my-1 prose-hr:my-2"
        />
      ) : thinking && !thought ? (
        <p className="text-xs text-ink-tertiary">小妍解读中…</p>
      ) : null}
    </div>
  );
}
