"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "clsx";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={clsx(
        "prose prose-sm max-w-none",
        "prose-headings:font-semibold prose-headings:text-gray-800",
        "prose-p:text-gray-700 prose-p:leading-relaxed",
        "prose-strong:text-gray-900 prose-strong:font-semibold",
        "prose-code:bg-gray-100 prose-code:rounded prose-code:px-1 prose-code:text-xs prose-code:text-gray-800 prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-gray-900 prose-pre:rounded-lg prose-pre:p-4",
        "prose-ul:text-gray-700 prose-ol:text-gray-700",
        "prose-blockquote:border-l-brand-400 prose-blockquote:text-gray-600",
        "prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
