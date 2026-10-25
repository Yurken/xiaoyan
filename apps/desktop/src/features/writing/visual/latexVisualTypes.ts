import type { JSONContent } from "@tiptap/core";

export type VisualNode = JSONContent;

export interface VisualRawPrefixPart {
  kind: "raw";
  raw: string;
}

export interface VisualMetaPrefixPart {
  kind: "meta";
  nodeType: "paperTitle" | "paperAuthor";
}

export type VisualPrefixPart = VisualRawPrefixPart | VisualMetaPrefixPart;

export interface VisualDocumentModel {
  source: string;
  prefix: VisualPrefixPart[];
  suffix: string;
  content: VisualNode[];
  readOnly: boolean;
  warning: string;
}

export interface VisualParseOptions {
  mainDocument?: boolean;
}

export interface LatexSourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface LatexAstArgument {
  content: LatexAstNode[];
  openMark: string;
  closeMark: string;
}

export interface LatexAstNode {
  type: string;
  content?: string | LatexAstNode[];
  env?: string | LatexAstNode;
  args?: LatexAstArgument[];
  position?: {
    start: LatexSourcePosition;
    end: LatexSourcePosition;
  };
}

export interface VisualSourceChange {
  source: string;
  changed: boolean;
}
