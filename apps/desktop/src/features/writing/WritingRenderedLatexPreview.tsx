import { useCallback, useMemo } from "react";
import { clsx } from "clsx";
import katex from "katex";

type RenderBlock =
  | { kind: "title"; title: string; author: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "math"; content: string };

interface WritingRenderedLatexPreviewProps {
  source: string;
}

export default function WritingRenderedLatexPreview({ source }: WritingRenderedLatexPreviewProps) {
  const blocks = useMemo(() => buildRenderBlocks(source), [source]);
  const renderLatex = useCallback((content: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(content, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span style="color:var(--rc-danger,#FF3B30)">${escapeHtml(content)}</span>`;
    }
  }, []);

  if (blocks.length === 0) {
    return (
      <div
        className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center text-ink-tertiary"
        style={{ borderColor: "var(--rc-border)" }}
      >
        <p className="text-xs">暂无可渲染内容。</p>
      </div>
    );
  }

  return (
    <article
      className="rc-selectable min-h-full rounded-xl border px-7 py-6"
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      {blocks.map((block, index) => {
        if (block.kind === "title") {
          return (
            <header
              key={`title-${index}`}
              className="mb-7 border-b pb-5 text-center"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <h2 className="text-xl font-black tracking-tight text-ink-primary">{block.title}</h2>
              {block.author ? <p className="mt-2 text-sm text-ink-tertiary">{block.author}</p> : null}
            </header>
          );
        }

        if (block.kind === "heading") {
          return (
            <h3
              key={`heading-${index}`}
              className={clsx(
                "mb-3 mt-6 tracking-tight text-ink-primary first:mt-0",
                block.level <= 1 ? "text-lg font-black" : block.level === 2 ? "text-base font-bold" : "text-sm font-bold",
              )}
            >
              {block.text}
            </h3>
          );
        }

        if (block.kind === "math") {
          return (
            <div
              key={`math-${index}`}
              className="my-4 overflow-x-auto rounded-xl border px-4 py-3 text-center"
              style={{ background: "var(--rc-card-inset-bg)", borderColor: "var(--rc-border)" }}
              dangerouslySetInnerHTML={{ __html: renderLatex(block.content, true) }}
            />
          );
        }

        return (
          <p key={`paragraph-${index}`} className="my-3 text-[13px] leading-7 text-ink-secondary">
            <InlineLatex text={block.text} renderLatex={renderLatex} />
          </p>
        );
      })}
    </article>
  );
}

function InlineLatex({
  text,
  renderLatex,
}: {
  text: string;
  renderLatex: (content: string, displayMode: boolean) => string;
}) {
  const parts = splitInlineMath(text);
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "math") {
          return (
            <span
              key={`${part.content}-${index}`}
              dangerouslySetInnerHTML={{ __html: renderLatex(part.content, false) }}
            />
          );
        }
        return <span key={`${part.content}-${index}`}>{part.content}</span>;
      })}
    </>
  );
}

function buildRenderBlocks(source: string): RenderBlock[] {
  const withoutComments = stripLatexComments(source);
  const blocks: RenderBlock[] = [];
  const title = matchLatexCommand(withoutComments, "title");
  const author = matchLatexCommand(withoutComments, "author");
  if (title || author) {
    blocks.push({
      kind: "title",
      title: cleanLatexInline(title || "未命名论文"),
      author: cleanLatexInline(author.replace(/\\and/g, "、")),
    });
  }

  const body = extractDocumentBody(withoutComments)
    .replace(/\\maketitle/g, "")
    .replace(/\\title(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\author(?:\[[^\]]*\])?\{[^}]*\}/g, "");

  for (const segment of splitDisplayMath(body)) {
    if (segment.kind === "math") {
      flushMathBlock(blocks, segment.content);
    } else {
      parseTextSegment(segment.content, blocks);
    }
  }

  return blocks.filter((block) => block.kind !== "paragraph" || block.text.trim().length > 0);
}

function parseTextSegment(value: string, blocks: RenderBlock[]) {
  let paragraph: string[] = [];
  const flushParagraph = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    paragraph = [];
  };

  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^\\(section|subsection|subsubsection|paragraph)\*?\{([^}]*)\}/);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: headingLevel(heading[1]),
        text: cleanLatexInline(heading[2]),
      });
      const rest = line.slice(heading[0].length).trim();
      if (rest) paragraph.push(cleanLatexTextLine(rest));
      continue;
    }

    if (/^\\begin\{abstract\}/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "heading", level: 1, text: "摘要" });
      const rest = line.replace(/^\\begin\{abstract\}/, "").trim();
      if (rest) paragraph.push(cleanLatexTextLine(rest));
      continue;
    }

    if (/^\\end\{abstract\}/.test(line)) {
      flushParagraph();
      continue;
    }

    const cleaned = cleanLatexTextLine(line);
    if (cleaned) paragraph.push(cleaned);
  }

  flushParagraph();
}

function splitDisplayMath(source: string): Array<{ kind: "text" | "math"; content: string }> {
  const segments: Array<{ kind: "text" | "math"; content: string }> = [];
  const regex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\3\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source))) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", content: source.slice(lastIndex, match.index) });
    }
    const environment = match[3] ?? "";
    const rawContent = match[1] ?? match[2] ?? match[4] ?? "";
    const content = normalizeDisplayMath(rawContent, environment);
    segments.push({ kind: "math", content });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    segments.push({ kind: "text", content: source.slice(lastIndex) });
  }

  return segments;
}

function splitInlineMath(text: string): Array<{ kind: "text" | "math"; content: string }> {
  const parts: Array<{ kind: "text" | "math"; content: string }> = [];
  const regex = /\\\(([\s\S]*?)\\\)|(?<!\\)\$([^\n$]+?)(?<!\\)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ kind: "math", content: (match[1] ?? match[2] ?? "").trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

function normalizeDisplayMath(content: string, environment: string): string {
  const cleaned = content
    .replace(/\\label\{[^}]*\}/g, "")
    .trim();
  if (/^(align|gather|multline)/.test(environment)) {
    return `\\begin{aligned}${cleaned}\\end{aligned}`;
  }
  return cleaned;
}

function flushMathBlock(blocks: RenderBlock[], content: string) {
  if (content.trim()) {
    blocks.push({ kind: "math", content: content.trim() });
  }
}

function extractDocumentBody(source: string): string {
  return source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)?.[1] ?? source;
}

function headingLevel(command: string): number {
  if (command === "section") return 1;
  if (command === "subsection") return 2;
  if (command === "subsubsection") return 3;
  return 4;
}

function cleanLatexTextLine(value: string): string {
  return splitInlineMath(value)
    .map((part) => part.kind === "math" ? `$${part.content}$` : cleanLatexTextOnly(part.content))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLatexTextOnly(value: string): string {
  return value
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\cite[a-zA-Z]*\*?(?:\[[^\]]*\])*\{([^}]*)\}/g, "[$1]")
    .replace(/\\ref\{([^}]*)\}/g, "$1")
    .replace(/\\bibliographystyle\{[^}]*\}/g, "")
    .replace(/\\bibliography\{[^}]*\}/g, "")
    .replace(/\\(begin|end)\{(document|abstract|itemize|enumerate|table|figure|center)\}/g, "")
    .replace(/\\item\b/g, "• ")
    .replace(/\\(textbf|textit|emph|underline)\{([^}]*)\}/g, "$2")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ");
}

function cleanLatexInline(value: string): string {
  return value
    .replace(/\\and/g, "、")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLatexCommand(source: string, command: string): string {
  return source.match(new RegExp(`\\\\${command}(?:\\[[^\\]]*\\])?\\{([^}]*)\\}`))?.[1] ?? "";
}

function stripLatexComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      let escaped = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === "\\" && !escaped) {
          escaped = true;
          continue;
        }
        if (char === "%" && !escaped) {
          return line.slice(0, index);
        }
        escaped = false;
      }
      return line;
    })
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
