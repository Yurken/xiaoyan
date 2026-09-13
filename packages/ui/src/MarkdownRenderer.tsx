"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { clsx } from "clsx";
import { Check, Copy } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onLinkClick?: (href: string) => void | Promise<void>;
  highlightSourceTags?: boolean;
}

function nodeToText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (props.children) {
      return nodeToText(props.children);
    }
  }
  return "";
}

function MarkdownCodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = nodeToText(children).replace(/\n$/, "");

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // 系统拒绝剪贴板访问时保留原状态，不打断阅读。
    }
  }

  return (
    <div className="not-prose relative my-4">
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={copied ? "已复制代码" : "复制代码"}
        title={copied ? "已复制" : "复制代码"}
        className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md opacity-65 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/35"
        style={{
          color: "var(--rc-code-block-text, #E8EDF5)",
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      <pre
        className="m-0 overflow-x-auto rounded-xl border"
        style={{
          background: "var(--rc-code-block-bg, #0B0F15)",
          borderColor: "var(--rc-code-block-border, rgba(255, 255, 255, 0.1))",
          color: "var(--rc-code-block-text, #E8EDF5)",
        }}
      >
        {children}
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content, className, onLinkClick, highlightSourceTags }: MarkdownRendererProps) {
  return (
    <div
      className={clsx(
        "rc-selectable prose prose-sm max-w-none",
        "prose-headings:font-semibold prose-headings:text-ink-primary",
        "prose-p:text-ink-secondary prose-p:leading-relaxed",
        "prose-strong:text-ink-primary prose-strong:font-semibold",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:my-4 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:p-0",
        "prose-ul:text-ink-secondary prose-ol:text-ink-secondary",
        "prose-li:text-ink-secondary",
        "prose-blockquote:border-l-apple-blue prose-blockquote:text-ink-tertiary",
        "prose-a:text-apple-blue prose-a:no-underline hover:prose-a:underline",
        "prose-img:rounded-xl",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!href || !onLinkClick) return;
                  event.preventDefault();
                  void onLinkClick(href);
                }}
                {...props}
              >
                {children}
              </a>
            );
          },
          strong({ children, ...props }) {
            if (highlightSourceTags) {
              const text = nodeToText(children);
              if (text.startsWith("来源：")) {
                return (
                  <span
                    className="inline-flex items-center rounded-full bg-apple-blue/10 px-2 py-0.5 text-xs font-medium text-apple-blue"
                    title={text}
                    {...props}
                  >
                    {children}
                  </span>
                );
              }
            }
            return <strong {...props}>{children}</strong>;
          },
          code({ className, children, ...props }) {
            const isBlock = Boolean(className?.includes("language-"));

            if (!isBlock) {
              return (
                <code
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.82em] text-slate-800"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className={clsx(
                  "block min-w-full bg-transparent px-4 py-4 font-mono text-[13px] leading-6",
                  className
                )}
                style={{ color: "var(--rc-code-block-text, #E8EDF5)" }}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <MarkdownCodeBlock>{children}</MarkdownCodeBlock>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
