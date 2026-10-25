import type { LatexAstArgument, LatexAstNode } from "./latexVisualTypes";

export function astChildren(node: LatexAstNode): LatexAstNode[] {
  return Array.isArray(node.content) ? node.content : [];
}

export function astEnvironmentName(node: LatexAstNode): string {
  if (typeof node.env === "string") return node.env;
  if (node.env && typeof node.env.content === "string") return node.env.content;
  return "";
}

export function astStart(node: LatexAstNode): number {
  return node.position?.start.offset ?? 0;
}

export function astTokenEnd(node: LatexAstNode): number {
  return node.position?.end.offset ?? astStart(node);
}

export function astEnd(node: LatexAstNode, source: string): number {
  if (node.type !== "macro") return node.position?.end.offset ?? source.length;
  let end = astTokenEnd(node);
  for (const argument of node.args ?? []) {
    if (!argument.openMark) continue;
    const range = readDelimitedRange(source, end, argument);
    if (!range) continue;
    end = range[1];
  }
  return end;
}

export function astRaw(node: LatexAstNode, source: string): string {
  return source.slice(astStart(node), astEnd(node, source));
}

export function lastMeaningfulArgument(node: LatexAstNode): LatexAstArgument | null {
  const args = (node.args ?? []).filter((argument) => argument.openMark || argument.content.length > 0);
  return args.at(-1) ?? null;
}

export function lastDelimitedArgumentRange(node: LatexAstNode, source: string): [number, number] | null {
  let end = astTokenEnd(node);
  let result: [number, number] | null = null;
  for (const argument of node.args ?? []) {
    if (!argument.openMark) continue;
    const range = readDelimitedRange(source, end, argument);
    if (!range) continue;
    result = range;
    end = range[1];
  }
  return result;
}

export function macroName(node: LatexAstNode): string {
  return typeof node.content === "string" ? node.content : "";
}

export function astPlainText(nodes: LatexAstNode[]): string {
  return nodes.map((node) => {
    if (typeof node.content === "string") return node.content;
    if (node.type === "whitespace" || node.type === "parbreak") return " ";
    return astPlainText(astChildren(node));
  }).join("");
}

export function readDelimitedRange(
  source: string,
  from: number,
  argument: LatexAstArgument,
): [number, number] | null {
  const start = source.indexOf(argument.openMark, from);
  if (start < 0) return null;
  const between = source.slice(from, start);
  if (between.trim() && !between.startsWith("%")) return null;
  if (argument.openMark === "{" || argument.openMark === "[") {
    const close = argument.openMark === "{" ? "}" : "]";
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
      if (isEscaped(source, index)) continue;
      if (source[index] === argument.openMark) depth += 1;
      if (source[index] !== close) continue;
      depth -= 1;
      if (depth === 0) return [start, index + 1];
    }
    return null;
  }
  const end = source.indexOf(argument.closeMark, start + argument.openMark.length);
  return end < 0 ? null : [start, end + argument.closeMark.length];
}

function isEscaped(source: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}
