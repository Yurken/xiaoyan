import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  BookOpen,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Sigma,
  Superscript,
  Underline,
  Undo2,
} from "lucide-react";

interface WritingVisualToolbarProps {
  editor: Editor | null;
  disabled: boolean;
  onOpenCitation: () => void;
  onInsertImage: () => void;
}

export default function WritingVisualToolbar({
  editor,
  disabled,
  onOpenCitation,
  onInsertImage,
}: WritingVisualToolbarProps) {
  const run = (command: () => void) => {
    if (!disabled) command();
  };
  return (
    <div className="writing-visual-toolbar" role="toolbar" aria-label="论文排版工具">
      <div className="writing-visual-toolbar__group">
        <ToolButton label="正文" disabled={disabled || !editor} active={editor?.isActive("paragraph")} onClick={() => run(() => editor?.chain().focus().setParagraph().run())}><Pilcrow size={15} /></ToolButton>
        <ToolButton label="一级标题" disabled={disabled || !editor} active={editor?.isActive("heading", { level: 1 })} onClick={() => run(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}><Heading1 size={15} /></ToolButton>
        <ToolButton label="二级标题" disabled={disabled || !editor} active={editor?.isActive("heading", { level: 2 })} onClick={() => run(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}><Heading2 size={15} /></ToolButton>
        <ToolButton label="三级标题" disabled={disabled || !editor} active={editor?.isActive("heading", { level: 3 })} onClick={() => run(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())}><Heading3 size={15} /></ToolButton>
      </div>
      <div className="writing-visual-toolbar__group">
        <ToolButton label="粗体 (⌘B)" disabled={disabled || !editor} active={editor?.isActive("bold")} onClick={() => run(() => editor?.chain().focus().toggleBold().run())}><Bold size={15} /></ToolButton>
        <ToolButton label="斜体 (⌘I)" disabled={disabled || !editor} active={editor?.isActive("italic")} onClick={() => run(() => editor?.chain().focus().toggleItalic().run())}><Italic size={15} /></ToolButton>
        <ToolButton label="下划线 (⌘U)" disabled={disabled || !editor} active={editor?.isActive("underline")} onClick={() => run(() => editor?.chain().focus().toggleUnderline().run())}><Underline size={15} /></ToolButton>
      </div>
      <div className="writing-visual-toolbar__group">
        <ToolButton label="项目列表" disabled={disabled || !editor} active={editor?.isActive("bulletList")} onClick={() => run(() => editor?.chain().focus().toggleBulletList().run())}><List size={15} /></ToolButton>
        <ToolButton label="编号列表" disabled={disabled || !editor} active={editor?.isActive("orderedList")} onClick={() => run(() => editor?.chain().focus().toggleOrderedList().run())}><ListOrdered size={15} /></ToolButton>
        <ToolButton label="行内公式" disabled={disabled || !editor} onClick={() => run(() => editor?.chain().focus().insertInlineMath({ latex: "x" }).run())}><Sigma size={15} /></ToolButton>
        <ToolButton label="独立公式" disabled={disabled || !editor} onClick={() => run(() => editor?.chain().focus().insertBlockMath({ latex: "x = y" }).run())}><Superscript size={15} /></ToolButton>
        <ToolButton label="插入参考文献" disabled={disabled || !editor} onClick={onOpenCitation}><BookOpen size={15} /></ToolButton>
        <ToolButton label="插入图片" disabled={disabled || !editor} onClick={onInsertImage}><ImagePlus size={15} /></ToolButton>
      </div>
      <div className="writing-visual-toolbar__group writing-visual-toolbar__history">
        <ToolButton label="撤销 (⌘Z)" disabled={disabled || !editor?.can().undo()} onClick={() => run(() => editor?.chain().focus().undo().run())}><Undo2 size={15} /></ToolButton>
        <ToolButton label="重做 (⇧⌘Z)" disabled={disabled || !editor?.can().redo()} onClick={() => run(() => editor?.chain().focus().redo().run())}><Redo2 size={15} /></ToolButton>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  children,
  active = false,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="writing-visual-tool"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
