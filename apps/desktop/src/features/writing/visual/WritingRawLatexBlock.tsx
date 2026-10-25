import { Braces, FileCode2, Image, Table2 } from "lucide-react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export default function WritingRawLatexBlock({ node, extension }: NodeViewProps) {
  const { raw, rawLabel, hidden, filePath } = node.attrs as {
    raw: string;
    rawLabel: string;
    hidden?: boolean;
    filePath?: string;
  };
  if (hidden) return <NodeViewWrapper className="writing-raw-hidden" />;
  const label = rawLabel || "LaTeX";
  const Icon = label === "图片" ? Image : label === "表格" ? Table2 : filePath ? FileCode2 : Braces;
  const excerpt = raw.trim().split("\n").slice(0, 3).join("\n");
  const editSource = extension.options.onEditSource as ((raw: string, path?: string) => void) | undefined;

  return (
    <NodeViewWrapper className="writing-raw-block" contentEditable={false}>
      <div className="writing-raw-block__meta">
        <Icon size={15} aria-hidden="true" />
        <span>{label}</span>
        <button type="button" onClick={() => editSource?.(raw, filePath || undefined)}>
          {filePath ? "打开章节" : "编辑源码"}
        </button>
      </div>
      <pre>{excerpt}{raw.trim().split("\n").length > 3 ? "\n…" : ""}</pre>
    </NodeViewWrapper>
  );
}
