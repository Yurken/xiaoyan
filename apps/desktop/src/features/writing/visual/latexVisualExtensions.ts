import { Extension, Node } from "@tiptap/core";
import { Mathematics } from "@tiptap/extension-mathematics";
import StarterKit from "@tiptap/starter-kit";
import { ReactNodeViewRenderer } from "@tiptap/react";
import WritingRawLatexBlock from "./WritingRawLatexBlock";

const SOURCE_ATTRIBUTES = {
  _raw: { default: "", rendered: false },
  _prefix: { default: "", rendered: false },
  _snapshot: { default: "", rendered: false },
  _commandPrefix: { default: "", rendered: false },
  _begin: { default: "", rendered: false },
  _end: { default: "", rendered: false },
};

interface VisualExtensionOptions {
  onMathClick: (kind: "inlineMath" | "blockMath", pos: number) => void;
  onEditSource: (raw: string, path?: string) => void;
}

export function createVisualExtensions({ onMathClick, onEditSource }: VisualExtensionOptions) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: { openOnClick: false } }),
    Extension.create({
      name: "latexSourceAttributes",
      addGlobalAttributes() {
        return [
          {
            types: ["paragraph", "heading", "paperTitle", "paperAuthor", "abstract", "bulletList", "orderedList", "listItem", "blockMath", "inlineMath"],
            attributes: {
              ...SOURCE_ATTRIBUTES,
              raw: { default: "", rendered: false },
              _sourceLatex: { default: "", rendered: false },
              _sourceLevel: { default: 0, rendered: false },
              env: { default: null, rendered: false },
            },
          },
          {
            types: ["bold", "italic", "underline"],
            attributes: { latexCommand: { default: null, rendered: false } },
          },
        ];
      },
    }),
    Node.create({
      name: "paperTitle",
      group: "block",
      content: "inline*",
      parseHTML() { return [{ tag: 'div[data-type="paper-title"]' }]; },
      renderHTML() { return ["div", { "data-type": "paper-title", class: "writing-paper-title" }, 0]; },
    }),
    Node.create({
      name: "paperAuthor",
      group: "block",
      content: "inline*",
      parseHTML() { return [{ tag: 'div[data-type="paper-author"]' }]; },
      renderHTML() { return ["div", { "data-type": "paper-author", class: "writing-paper-author" }, 0]; },
    }),
    Node.create({
      name: "abstract",
      group: "block",
      content: "paragraph+",
      parseHTML() { return [{ tag: 'section[data-type="abstract"]' }]; },
      renderHTML() { return ["section", { "data-type": "abstract", class: "writing-abstract", "data-label": "摘要" }, 0]; },
    }),
    Node.create({
      name: "citation",
      group: "inline",
      inline: true,
      atom: true,
      addAttributes() {
        return {
          command: { default: "\\cite", rendered: false },
          keys: { default: [], rendered: false },
          raw: { default: "", rendered: false },
          _commandPrefix: { default: "", rendered: false },
          _sourceKeys: { default: "", rendered: false },
        };
      },
      parseHTML() { return [{ tag: 'span[data-type="citation"]' }]; },
      renderHTML({ node }) {
        const keys = Array.isArray(node.attrs.keys) ? node.attrs.keys.join(", ") : node.attrs.keys;
        return ["span", { "data-type": "citation", class: "writing-citation", "data-command": node.attrs.command }, `[${keys}]`];
      },
    }),
    Node.create({
      name: "reference",
      group: "inline",
      inline: true,
      atom: true,
      addAttributes() {
        return {
          command: { default: "\\ref", rendered: false },
          keys: { default: [], rendered: false },
          raw: { default: "", rendered: false },
          _commandPrefix: { default: "", rendered: false },
          _sourceKeys: { default: "", rendered: false },
        };
      },
      parseHTML() { return [{ tag: 'span[data-type="reference"]' }]; },
      renderHTML({ node }) {
        const keys = Array.isArray(node.attrs.keys) ? node.attrs.keys.join(", ") : node.attrs.keys;
        return ["span", { "data-type": "reference", class: "writing-reference" }, `↗ ${keys}`];
      },
    }),
    Node.create({
      name: "latexRawInline",
      group: "inline",
      inline: true,
      atom: true,
      selectable: false,
      addAttributes() {
        return {
          raw: { default: "", rendered: false },
          rawLabel: { default: "LaTeX", rendered: false },
          hidden: { default: false, rendered: false },
        };
      },
      parseHTML() { return [{ tag: 'span[data-type="latex-raw-inline"]' }]; },
      renderHTML({ node }) {
        return ["span", {
          "data-type": "latex-raw-inline",
          class: node.attrs.hidden ? "writing-raw-hidden" : "writing-raw-inline",
          title: node.attrs.raw,
        }, node.attrs.rawLabel || ""];
      },
    }),
    Node.create({
      name: "latexRaw",
      group: "block",
      atom: true,
      selectable: false,
      addOptions() { return { onEditSource }; },
      addAttributes() {
        return {
          ...SOURCE_ATTRIBUTES,
          raw: { default: "", rendered: false },
          rawLabel: { default: "LaTeX", rendered: false },
          hidden: { default: false, rendered: false },
          filePath: { default: "", rendered: false },
        };
      },
      parseHTML() { return [{ tag: 'div[data-type="latex-raw"]' }]; },
      renderHTML() { return ["div", { "data-type": "latex-raw" }]; },
      addNodeView() { return ReactNodeViewRenderer(WritingRawLatexBlock); },
    }),
    Mathematics.configure({
      katexOptions: { throwOnError: false, strict: false },
      inlineOptions: { onClick: (_node, pos) => onMathClick("inlineMath", pos) },
      blockOptions: { onClick: (_node, pos) => onMathClick("blockMath", pos) },
    }),
  ];
}
