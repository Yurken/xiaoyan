import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { clsx } from "clsx";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onLinkClick?: (href: string) => void | Promise<void>;
}

export default function MarkdownRenderer({ content, className, onLinkClick }: MarkdownRendererProps) {
  return (
    <div
      className={clsx(
        "rc-selectable prose prose-sm max-w-none",
        "prose-headings:font-semibold prose-headings:text-ink-primary",
        "prose-p:text-ink-secondary prose-p:leading-relaxed",
        "prose-strong:text-ink-primary prose-strong:font-semibold",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:my-4 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-700 prose-pre:bg-slate-950 prose-pre:p-0",
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
                  "block min-w-full bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-slate-100",
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return (
              <pre className="not-prose my-4 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950">
                {children}
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
