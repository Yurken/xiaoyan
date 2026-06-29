import { useMemo, useState } from "react";
import { Check, Copy, Sparkles, Terminal } from "lucide-react";
import { clsx } from "clsx";
import { MarkdownRenderer } from "@research-copilot/ui";

interface CodeAssistantMessageProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

type Segment =
  | { type: "markdown"; content: string }
  | { type: "thinking"; content: string }
  | { type: "command"; language: string; code: string };

function parseClosedMarkdown(content: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /```([^\n`]*)\n([\s\S]*?)\n```/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "markdown", content: content.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "command",
      language: match[1].trim().toLowerCase() || "text",
      code: match[2],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "markdown", content: content.slice(lastIndex) });
  }

  return segments;
}

function parseAssistantContent(content: string, streaming = false): Segment[] {
  const segments: Segment[] = [];
  const thinkRegex = /<(thinking|think)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = thinkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...parseClosedMarkdown(content.slice(lastIndex, match.index)));
    }
    segments.push({ type: "thinking", content: match[2] });
    lastIndex = thinkRegex.lastIndex;
  }

  const tail = content.slice(lastIndex);

  if (streaming) {
    const openMatch = tail.match(/<(thinking|think)>/i);
    if (openMatch) {
      const openIndex = openMatch.index ?? 0;
      if (openIndex > 0) {
        segments.push(...parseClosedMarkdown(tail.slice(0, openIndex)));
      }
      segments.push({ type: "thinking", content: tail.slice(openIndex + openMatch[0].length) });
      return segments;
    }
  }

  if (tail) {
    segments.push(...parseClosedMarkdown(tail));
  }

  return segments;
}

function ThinkingBlock({ content }: { content: string }) {
  return (
    <details className="code-thinking-block">
      <summary className="code-thinking-block__summary">
        <Sparkles size={12} />
        <span>思考过程</span>
      </summary>
      <pre className="code-thinking-block__content">
        <code>{content}</code>
      </pre>
    </details>
  );
}

function CommandBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const isShell = ["bash", "shell", "sh", "zsh"].includes(language);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <details className="code-command-block" open>
      <summary className="code-command-block__summary">
        <span className="code-command-block__summary-left">
          <Terminal size={12} />
          <span>
            {isShell ? "命令" : "代码"} · {language}
          </span>
        </span>
      </summary>
      <div className="code-command-block__body">
        <button
          type="button"
          onClick={handleCopy}
          className="code-command-block__copy"
          aria-label={copied ? "已复制" : "复制命令"}
          title={copied ? "已复制" : "复制命令"}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </details>
  );
}

export default function CodeAssistantMessage({ content, className, streaming }: CodeAssistantMessageProps) {
  const segments = useMemo(() => parseAssistantContent(content, streaming), [content, streaming]);

  return (
    <div className={clsx("code-assistant-message", className)}>
      {segments.map((segment, index) => {
        const key = `${segment.type}-${index}`;
        if (segment.type === "thinking") {
          return <ThinkingBlock key={key} content={segment.content} />;
        }
        if (segment.type === "command") {
          return <CommandBlock key={key} language={segment.language} code={segment.code} />;
        }
        return <MarkdownRenderer key={key} content={segment.content} className="code-chat-md" />;
      })}
    </div>
  );
}
