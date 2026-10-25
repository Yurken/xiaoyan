import { parse } from "@unified-latex/unified-latex-util-parse";
import {
  astEnd,
  astEnvironmentName,
  astStart,
  macroName,
} from "./latexVisualAst";
import { createPaperMetaNode, createSourcedNode, parseVisualBody } from "./latexVisualDocument";
import type {
  LatexAstNode,
  VisualDocumentModel,
  VisualNode,
  VisualParseOptions,
  VisualPrefixPart,
} from "./latexVisualTypes";

export function parseLatexVisualDocument(source: string, options: VisualParseOptions = {}): VisualDocumentModel {
  try {
    const root = parse(source) as unknown as LatexAstNode;
    const children = Array.isArray(root.content) ? root.content : [];
    const document = options.mainDocument === false
      ? null
      : children.find((node) => node.type === "environment" && astEnvironmentName(node) === "document");
    if (!document) return fragmentModel(source, children);

    const documentStart = astStart(document);
    const documentEnd = astEnd(document, source);
    const documentRaw = source.slice(documentStart, documentEnd);
    const begin = /\\begin\s*\{document\}/.exec(documentRaw);
    const endings = [...documentRaw.matchAll(/\\end\s*\{document\}/g)];
    const end = endings.at(-1);
    if (!begin || end?.index === undefined) throw new Error("document environment bounds are unavailable");

    const bodyStart = documentStart + begin.index + begin[0].length;
    const { prefix, metadata } = parsePrefix(source.slice(0, bodyStart));
    const bodyNodes = Array.isArray(document.content) ? document.content : [];
    const body = parseVisualBody(bodyNodes, source, bodyStart);
    return {
      source,
      prefix,
      suffix: source.slice(trailingBodyOffset(bodyNodes, source, bodyStart)),
      content: [...metadata, ...withEmptyParagraph(body)],
      readOnly: false,
      warning: "",
    };
  } catch {
    return readOnlyModel(source);
  }
}

export function parseLatexVisualFragment(source: string): VisualNode[] {
  const root = parse(source) as unknown as LatexAstNode;
  const content = Array.isArray(root.content) ? root.content : [];
  return withEmptyParagraph(parseVisualBody(content, source));
}

function fragmentModel(source: string, children: LatexAstNode[]): VisualDocumentModel {
  return {
    source,
    prefix: [],
    suffix: source.slice(trailingBodyOffset(children, source, 0)),
    content: withEmptyParagraph(parseVisualBody(children, source)),
    readOnly: false,
    warning: "",
  };
}

function trailingBodyOffset(nodes: LatexAstNode[], source: string, emptyOffset: number): number {
  const last = [...nodes].reverse().find((node) => node.type !== "whitespace" && node.type !== "parbreak");
  return last ? astEnd(last, source) : emptyOffset;
}

function parsePrefix(source: string): { prefix: VisualPrefixPart[]; metadata: VisualNode[] } {
  const root = parse(source) as unknown as LatexAstNode;
  const prefix: VisualPrefixPart[] = [];
  const metadata: VisualNode[] = [];
  let cursor = 0;
  for (const node of Array.isArray(root.content) ? root.content : []) {
    if (node.type !== "macro") continue;
    const name = macroName(node);
    const nodeType = name === "title" ? "paperTitle" : name === "author" ? "paperAuthor" : null;
    if (!nodeType || metadata.some((child) => child.type === nodeType)) continue;
    const meta = createPaperMetaNode(node, source, nodeType);
    if (!meta) continue;
    const start = astStart(node);
    if (start < cursor) continue;
    prefix.push({ kind: "raw", raw: source.slice(cursor, start) }, { kind: "meta", nodeType });
    metadata.push(meta);
    cursor = astEnd(node, source);
  }
  prefix.push({ kind: "raw", raw: source.slice(cursor) });
  return { prefix, metadata };
}

function readOnlyModel(source: string): VisualDocumentModel {
  return {
    source,
    prefix: [],
    suffix: "",
    content: [createSourcedNode("latexRaw", source, "", {
      raw: source,
      rawLabel: "当前文档需要源码编辑",
    })],
    readOnly: true,
    warning: "暂时无法安全解析这份 LaTeX。已保留全部源码，请切换到源码模式继续编辑。",
  };
}

function withEmptyParagraph(content: VisualNode[]): VisualNode[] {
  return content.length > 0 ? content : [createSourcedNode("paragraph", "", "", {}, [])];
}
