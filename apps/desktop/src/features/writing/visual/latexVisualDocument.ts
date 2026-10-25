import { printRaw as printRawAst } from "@unified-latex/unified-latex-util-print-raw";
import {
  astChildren,
  astEnd,
  astEnvironmentName,
  astPlainText,
  astRaw,
  astStart,
  astTokenEnd,
  lastDelimitedArgumentRange,
  lastMeaningfulArgument,
  macroName,
} from "./latexVisualAst";
import { visualSnapshot } from "./latexVisualShared";
import type { LatexAstNode, VisualNode } from "./latexVisualTypes";

function printRaw(value: LatexAstNode | LatexAstNode[]): string {
  return printRawAst(value as Parameters<typeof printRawAst>[0]);
}

const HIDDEN_MACROS = new Set([
  "maketitle", "bibliography", "bibliographystyle", "printbibliography",
  "tableofcontents", "listoffigures", "listoftables", "appendix", "newpage", "clearpage",
]);
const HEADING_LEVELS: Record<string, number> = { section: 1, subsection: 2, subsubsection: 3, paragraph: 4 };
const FORMAT_MARKS: Record<string, string> = { textbf: "bold", textit: "italic", emph: "italic", underline: "underline" };

export function createSourcedNode(
  type: string,
  raw: string,
  prefix: string,
  attrs: Record<string, unknown>,
  content?: VisualNode[],
): VisualNode {
  const node: VisualNode = {
    type,
    attrs: { ...attrs, _raw: raw, _prefix: prefix },
    ...(content ? { content } : {}),
  };
  node.attrs = { ...node.attrs, _snapshot: visualSnapshot(node) };
  return node;
}

export function parseVisualBody(nodes: LatexAstNode[], source: string, initialCursor?: number): VisualNode[] {
  const blocks: VisualNode[] = [];
  let inline: LatexAstNode[] = [];
  let paragraphStart = -1;
  let cursor = initialCursor ?? nodes.find((node) => node.position)?.position?.start.offset ?? 0;

  const flushParagraph = () => {
    if (paragraphStart < 0) return;
    const content = parseVisualInline(inline, source);
    const raw = source.slice(paragraphStart, cursor);
    if (content.length > 0) blocks.push(createSourcedNode("paragraph", raw, "", {}, content));
    inline = [];
    paragraphStart = -1;
  };

  const appendInline = (node: LatexAstNode, _start: number, end: number) => {
    if (paragraphStart < 0) paragraphStart = cursor;
    inline.push(node);
    cursor = Math.max(cursor, end);
  };

  for (const node of nodes) {
    const start = node.position ? Math.max(cursor, astStart(node)) : cursor;
    const end = node.position ? Math.max(start, astEnd(node, source)) : cursor;
    const ownRaw = node.position ? source.slice(start, end) : printRaw(node);

    if (node.type === "parbreak") {
      flushParagraph();
      continue;
    }
    if (node.type === "whitespace" && paragraphStart < 0) continue;
    if (node.type === "comment" && paragraphStart < 0) {
      blocks.push(createRawBlock(ownRaw, source.slice(cursor, start), "注释", true));
      cursor = end;
      continue;
    }

    if (node.type === "macro") {
      const name = macroName(node);
      const level = HEADING_LEVELS[name];
      const argument = lastMeaningfulArgument(node);
      const argumentRange = lastDelimitedArgumentRange(node, source);
      if (level && argument && argumentRange) {
        flushParagraph();
        const raw = source.slice(cursor, end);
        const heading = createSourcedNode(
          "heading",
          raw,
          source.slice(cursor, start),
          { level, _sourceLevel: level, _commandPrefix: source.slice(start, argumentRange[0]) },
          parseVisualInline(argument.content, source),
        );
        blocks.push(heading);
        cursor = end;
        continue;
      }
      if (HIDDEN_MACROS.has(name) || name === "title" || name === "author" || name === "date") {
        flushParagraph();
        blocks.push(createRawBlock(ownRaw, source.slice(cursor, start), name, true));
        cursor = end;
        continue;
      }
      if (name === "input" || name === "include") {
        flushParagraph();
        const path = argument ? astPlainText(argument.content).trim() : "章节";
        blocks.push(createRawBlock(ownRaw, source.slice(cursor, start), `章节文件：${path}`, false, path));
        cursor = end;
        continue;
      }
    }

    if (node.type === "environment" || node.type === "mathenv") {
      flushParagraph();
      const prefix = source.slice(cursor, start);
      const environment = astEnvironmentName(node);
      if (node.type === "mathenv") {
        const math = createMathBlock(node, source, prefix);
        if (math) blocks.push(math);
        else blocks.push(createRawBlock(ownRaw, prefix, "独立公式"));
      } else if (environment === "abstract") {
        const content = parseVisualBody(astChildren(node), source, firstContentOffset(node));
        if (content.length > 0 && content.every((child) => child.type === "paragraph")) {
          blocks.push(createSourcedNode("abstract", source.slice(cursor, end), prefix, {
            _begin: source.slice(start, firstContentOffset(node)),
            _end: source.slice(lastContentOffset(node, source), end),
          }, content));
        } else {
          blocks.push(createRawBlock(ownRaw, prefix, "摘要"));
        }
      } else if (environment === "itemize" || environment === "enumerate") {
        const list = createListBlock(node, source, prefix);
        blocks.push(list ?? createRawBlock(ownRaw, prefix, "列表"));
      } else {
        const label = environment === "figure" ? "图片" : environment === "table" ? "表格" : `${environment || "LaTeX"} 环境`;
        blocks.push(createRawBlock(ownRaw, prefix, label));
      }
      cursor = end;
      continue;
    }

    appendInline(node, start, end);
  }
  flushParagraph();
  return blocks;
}

export function createPaperMetaNode(node: LatexAstNode, source: string, nodeType: "paperTitle" | "paperAuthor"): VisualNode | null {
  const argument = lastMeaningfulArgument(node);
  const argumentRange = lastDelimitedArgumentRange(node, source);
  if (!argument || !argumentRange) return null;
  const start = astStart(node);
  const end = astEnd(node, source);
  return createSourcedNode(nodeType, source.slice(start, end), "", {
    _commandPrefix: source.slice(start, argumentRange[0]),
  }, parseVisualInline(argument.content, source));
}

export function parseVisualInline(
  nodes: LatexAstNode[],
  source: string,
  marks: NonNullable<VisualNode["marks"]> = [],
): VisualNode[] {
  const result: VisualNode[] = [];
  for (const node of nodes) {
    const appendText = (text: string) => {
      if (!text) return;
      const previous = result.at(-1);
      const nextMarks = marks.length ? marks : undefined;
      if (previous?.type === "text" && JSON.stringify(previous.marks ?? []) === JSON.stringify(nextMarks ?? [])) {
        previous.text = `${previous.text ?? ""}${text}`;
      } else {
        result.push({ type: "text", text, ...(nextMarks ? { marks: nextMarks } : {}) });
      }
    };

    if (node.type === "string") {
      appendText(typeof node.content === "string" ? node.content : "");
      continue;
    }
    if (node.type === "whitespace") {
      appendText(" ");
      continue;
    }
    if (node.type === "parbreak") {
      result.push({ type: "hardBreak" });
      continue;
    }
    if (node.type === "inlinemath") {
      const latex = printRaw(astChildren(node)).trim();
      result.push({ type: "inlineMath", attrs: { latex, raw: astRaw(node, source), _sourceLatex: latex } });
      continue;
    }
    if (node.type === "group" && marks.length > 0) {
      result.push(...parseVisualInline(astChildren(node), source, marks));
      continue;
    }
    if (node.type === "macro") {
      const name = macroName(node);
      const argument = lastMeaningfulArgument(node);
      const markType = FORMAT_MARKS[name];
      if (markType && argument) {
        result.push(...parseVisualInline(argument.content, source, [...marks, {
          type: markType,
          attrs: { latexCommand: name },
        }]));
        continue;
      }
      const argumentRange = lastDelimitedArgumentRange(node, source);
      if (argument && argumentRange && (/^cite[a-zA-Z]*$/.test(name) || /^(?:eq|auto|page)?ref$|^cref$|^Cref$/.test(name))) {
        const raw = astRaw(node, source);
        const keys = astPlainText(argument.content).split(",").map((key) => key.trim()).filter(Boolean);
        result.push({
          type: name.startsWith("cite") ? "citation" : "reference",
          attrs: {
            command: `\\${name}`,
            keys,
            raw,
            _commandPrefix: source.slice(astStart(node), argumentRange[0]),
            _sourceKeys: keys.join(","),
          },
        });
        continue;
      }
      result.push(createRawInline(astRaw(node, source), name === "and" ? "、" : `\\${name}`));
      continue;
    }
    result.push(createRawInline(astRaw(node, source), node.type === "comment" ? "" : "LaTeX"));
  }
  return result;
}

function createMathBlock(node: LatexAstNode, source: string, prefix: string): VisualNode | null {
  const children = astChildren(node);
  const mathNodes = children.filter((child) => !(child.type === "macro" && macroName(child) === "label"));
  const latex = printRaw(mathNodes).trim();
  const start = astStart(node);
  const end = astEnd(node, source);
  const firstMath = mathNodes.find((child) => child.type !== "whitespace" && child.position);
  const firstLabel = children.find((child) => child.type === "macro" && macroName(child) === "label");
  if (!firstMath?.position) return null;
  const suffixStart = firstLabel?.position ? astStart(firstLabel) : lastContentOffset(node, source);
  return createSourcedNode("blockMath", source.slice(Math.max(0, start - prefix.length), end), prefix, {
    latex,
    _sourceLatex: latex,
    _begin: source.slice(start, astStart(firstMath)),
    _end: source.slice(suffixStart, end),
  });
}

function createListBlock(node: LatexAstNode, source: string, prefix: string): VisualNode | null {
  const environment = astEnvironmentName(node);
  const items = astChildren(node).filter((child) => child.type === "macro" && macroName(child) === "item");
  if (items.length === 0) return null;
  const start = astStart(node);
  const end = astEnd(node, source);
  const closeStart = environment ? source.lastIndexOf(`\\end{${environment}}`, end) : end;
  const itemNodes: VisualNode[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const argument = lastMeaningfulArgument(item);
    if (!argument) return null;
    const itemStart = astStart(item);
    const itemEnd = index + 1 < items.length ? astStart(items[index + 1]) : closeStart;
    const itemPrefix = "";
    const content = parseVisualBody(argument.content, source, firstArgumentOffset(argument.content));
    if (content.length === 0) return null;
    itemNodes.push(createSourcedNode(
      "listItem",
      source.slice(itemStart - itemPrefix.length, itemEnd),
      itemPrefix,
      {},
      content,
    ));
  }
  return createSourcedNode(
    environment === "itemize" ? "bulletList" : "orderedList",
    source.slice(start - prefix.length, end),
    prefix,
    {
      env: environment,
      _begin: source.slice(start, astStart(items[0])),
      _end: source.slice(closeStart, end),
    },
    itemNodes,
  );
}

function createRawBlock(raw: string, prefix: string, rawLabel: string, hidden = false, filePath = ""): VisualNode {
  return createSourcedNode("latexRaw", `${prefix}${raw}`, prefix, { raw, rawLabel, hidden, filePath });
}

function createRawInline(raw: string, rawLabel: string): VisualNode {
  return { type: "latexRawInline", attrs: { raw, rawLabel, hidden: rawLabel.length === 0 } };
}

function firstContentOffset(node: LatexAstNode): number {
  return firstArgumentOffset(astChildren(node));
}

function firstArgumentOffset(nodes: LatexAstNode[]): number {
  return nodes.find((node) => node.position)?.position?.start.offset ?? 0;
}

function lastContentOffset(node: LatexAstNode, source: string): number {
  const children = astChildren(node);
  const last = children.at(-1);
  return last?.position ? astEnd(last, source) : astTokenEnd(node);
}
