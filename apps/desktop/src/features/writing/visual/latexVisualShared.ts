import type { VisualNode } from "./latexVisualTypes";

export function visualSnapshot(node: VisualNode): string {
  return JSON.stringify(snapshotNode(node));
}

export function isUnmodifiedVisualNode(node: VisualNode): boolean {
  const attrs = node.attrs ?? {};
  return typeof attrs._raw === "string" && attrs._snapshot === visualSnapshot(node);
}

export function stringAttr(node: VisualNode, name: string, fallback = ""): string {
  const value = node.attrs?.[name];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function numberAttr(node: VisualNode, name: string, fallback: number): number {
  const value = node.attrs?.[name];
  return typeof value === "number" ? value : fallback;
}

export function booleanAttr(node: VisualNode, name: string): boolean {
  return node.attrs?.[name] === true;
}

export function escapeLatexText(value: string): string {
  return value.replace(/[\\#$%&_{}~^]/g, (character) => {
    switch (character) {
      case "\\": return "\\textbackslash{}";
      case "~": return "\\textasciitilde{}";
      case "^": return "\\textasciicircum{}";
      default: return `\\${character}`;
    }
  });
}

export function visualNodeText(node: VisualNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "inlineMath" || node.type === "blockMath") return stringAttr(node, "latex");
  if (node.type === "citation" || node.type === "reference") {
    const keys = node.attrs?.keys;
    return Array.isArray(keys) ? keys.join(", ") : stringAttr(node, "key");
  }
  return (node.content ?? []).map(visualNodeText).join(node.type === "paragraph" ? "\n" : "");
}

function snapshotNode(node: VisualNode): unknown {
  const attrs = Object.fromEntries(
    Object.entries(node.attrs ?? {}).filter(([key, value]) =>
      value !== null && !key.startsWith("_") && key !== "rawLabel" && (key !== "raw" || value !== "") && (key !== "start" || value !== 1)
    ),
  );
  return {
    type: node.type,
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.marks?.length ? { marks: node.marks.map((mark) => snapshotNode(mark)) } : {}),
    ...(node.content ? { content: node.content.map((child) => snapshotNode(child)) } : {}),
  };
}
