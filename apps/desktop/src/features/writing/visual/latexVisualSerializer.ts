import {
  escapeLatexText,
  isUnmodifiedVisualNode,
  stringAttr,
} from "./latexVisualShared";
import type { VisualDocumentModel, VisualNode, VisualSourceChange } from "./latexVisualTypes";

export function serializeLatexVisualDocument(model: VisualDocumentModel, document: VisualNode): VisualSourceChange {
  if (model.readOnly) return { source: model.source, changed: false };
  const content = document.content ?? [];
  const prefix = model.prefix.map((part) => {
    if (part.kind === "raw") return part.raw;
    const node = content.find((child) => child.type === part.nodeType);
    return node ? serializeMetaNode(node) : "";
  }).join("");
  const body = serializeVisualBlocks(content.filter((node) => node.type !== "paperTitle" && node.type !== "paperAuthor"));
  const source = `${prefix}${body.source}${model.suffix}`;
  return { source, changed: source !== model.source };
}

export function serializeVisualFragment(nodes: VisualNode[]): string {
  return serializeVisualBlocks(nodes).source;
}

export function serializeVisualBlocks(nodes: VisualNode[]): VisualSourceChange {
  let source = "";
  let changed = false;
  for (const node of nodes) {
    const result = serializeVisualBlock(node);
    if (source && result.source && (changed || result.changed) && !hasBlockBoundary(source, result.source)) {
      source += "\n\n";
    }
    source += result.source;
    changed ||= result.changed;
  }
  return { source, changed };
}

function serializeVisualBlock(node: VisualNode): VisualSourceChange {
  if (isUnmodifiedVisualNode(node)) return { source: stringAttr(node, "_raw"), changed: false };
  const prefix = stringAttr(node, "_prefix");
  if (node.type === "latexRaw") {
    return { source: stringAttr(node, "_raw", stringAttr(node, "raw")), changed: false };
  }
  if (node.type === "paperTitle" || node.type === "paperAuthor") {
    const command = stringAttr(node, "_commandPrefix", node.type === "paperTitle" ? "\\title" : "\\author");
    return changed(`${prefix}${command}{${serializeVisualInline(node.content ?? [])}}`);
  }
  if (node.type === "heading") {
    const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
    const commands = ["section", "subsection", "subsubsection", "paragraph"];
    const originalPrefix = stringAttr(node, "_commandPrefix");
    const command = node.attrs?._sourceLevel === level
      ? originalPrefix || `\\${commands[level - 1]}`
      : originalPrefix.replace(/^\\(?:section|subsection|subsubsection|paragraph)/, `\\${commands[level - 1]}`) || `\\${commands[level - 1]}`;
    return changed(`${prefix}${command}{${serializeVisualInline(node.content ?? [])}}`);
  }
  if (node.type === "abstract") {
    const children = serializeVisualBlocks(node.content ?? []);
    return changed(`${prefix}${stringAttr(node, "_begin", "\\begin{abstract}\n")}${children.source}${stringAttr(node, "_end", "\n\\end{abstract}")}`);
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const environment = node.type === "bulletList" ? "itemize" : "enumerate";
    const originalEnvironment = stringAttr(node, "env", environment);
    const keepWrapper = originalEnvironment === environment;
    const children = serializeVisualBlocks(node.content ?? []);
    const begin = keepWrapper ? stringAttr(node, "_begin", `\\begin{${environment}}\n`) : `\\begin{${environment}}\n`;
    const end = keepWrapper ? stringAttr(node, "_end", `\\end{${environment}}`) : `\\end{${environment}}`;
    return changed(`${prefix}${begin}${children.source}${end}`);
  }
  if (node.type === "listItem") {
    const children = serializeVisualBlocks(node.content ?? []);
    return changed(`${prefix}\\item ${children.source.trim()}\n`);
  }
  if (node.type === "blockMath") {
    return changed(`${prefix}${stringAttr(node, "_begin", "\\[\n")}${stringAttr(node, "latex")}${stringAttr(node, "_end", "\n\\]")}`);
  }
  if (node.type === "paragraph") {
    return changed(`${prefix}${serializeVisualInline(node.content ?? [])}`);
  }
  return changed(`${prefix}${serializeVisualInline(node.content ?? [])}`);
}

function serializeMetaNode(node: VisualNode): string {
  if (isUnmodifiedVisualNode(node)) return stringAttr(node, "_raw");
  return `${stringAttr(node, "_commandPrefix", "\\title")}{${serializeVisualInline(node.content ?? [])}}`;
}

function serializeVisualInline(nodes: VisualNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text") {
      return (node.marks ?? []).reduceRight((value, mark) => {
        const defaults: Record<string, string> = { bold: "textbf", italic: "textit", underline: "underline" };
        const command = typeof mark.attrs?.latexCommand === "string"
          ? mark.attrs.latexCommand
          : defaults[mark.type];
        return command ? `\\${command}{${value}}` : value;
      }, escapeLatexText(node.text ?? ""));
    }
    if (node.type === "hardBreak") return "\\\\\n";
    if (node.type === "inlineMath") {
      const latex = stringAttr(node, "latex");
      return stringAttr(node, "_sourceLatex") === latex && stringAttr(node, "raw")
        ? stringAttr(node, "raw")
        : `$${latex}$`;
    }
    if (node.type === "citation" || node.type === "reference") {
      const keys = Array.isArray(node.attrs?.keys)
        ? node.attrs.keys.filter((key): key is string => typeof key === "string")
        : [stringAttr(node, "key")].filter(Boolean);
      const joined = keys.join(",");
      if (stringAttr(node, "_sourceKeys") === joined && stringAttr(node, "raw")) return stringAttr(node, "raw");
      return `${stringAttr(node, "_commandPrefix", stringAttr(node, "command", node.type === "citation" ? "\\cite" : "\\ref"))}{${joined}}`;
    }
    if (node.type === "latexRawInline") return stringAttr(node, "raw");
    if (node.type === "blockMath") return serializeVisualBlock(node).source;
    return serializeVisualInline(node.content ?? []);
  }).join("");
}

function changed(source: string): VisualSourceChange {
  return { source, changed: true };
}

function hasBlockBoundary(left: string, right: string): boolean {
  return /(?:\n\s*){2}$/.test(left) || /^(?:\s*\n){2}/.test(right);
}
