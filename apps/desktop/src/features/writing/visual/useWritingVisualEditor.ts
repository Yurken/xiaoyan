import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import { createVisualExtensions } from "./latexVisualExtensions";
import { parseLatexVisualDocument, parseLatexVisualFragment } from "./latexVisualParser";
import { serializeLatexVisualDocument, serializeVisualFragment } from "./latexVisualSerializer";
import type { VisualDocumentModel, VisualNode } from "./latexVisualTypes";

interface UseWritingVisualEditorOptions {
  documentId: string;
  source: string;
  mainDocument: boolean;
  onSourceChange: (source: string) => void;
  onEditSource: (raw: string, path?: string) => void;
}

interface ActiveNode {
  kind: "inlineMath" | "blockMath" | "citation" | "reference";
  pos: number;
}

export function useWritingVisualEditor({
  documentId,
  source,
  mainDocument,
  onSourceChange,
  onEditSource,
}: UseWritingVisualEditorOptions) {
  const initialModelRef = useRef<VisualDocumentModel | null>(null);
  if (!initialModelRef.current) initialModelRef.current = parseLatexVisualDocument(source, { mainDocument });
  const initialModel = initialModelRef.current;
  const modelRef = useRef(initialModel);
  const latestSourceRef = useRef(source);
  const loadedDocumentRef = useRef(documentId);
  const callbacksRef = useRef({ onSourceChange, onEditSource });
  callbacksRef.current = { onSourceChange, onEditSource };
  const [warning, setWarning] = useState(initialModel.warning);
  const [activeMath, setActiveMath] = useState<ActiveNode | null>(null);
  const [activeCitation, setActiveCitation] = useState<ActiveNode | null>(null);

  const extensions = useMemo(() => createVisualExtensions({
    onMathClick: (kind, pos) => {
      setActiveCitation(null);
      setActiveMath({ kind, pos });
    },
    onEditSource: (raw, path) => callbacksRef.current.onEditSource(raw, path),
  }), []);

  const editor = useEditor({
    extensions,
    content: { type: "doc", content: initialModel.content },
    editable: !initialModel.readOnly,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "writing-visual-content",
        "aria-label": "论文可视化编辑器",
        spellcheck: "true",
      },
      handleClickOn: (_view, _pos, node, nodePos) => {
        if (node.type.name !== "citation" && node.type.name !== "reference") return false;
        setActiveMath(null);
        setActiveCitation({ kind: node.type.name, pos: nodePos });
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (modelRef.current.readOnly) return;
      const result = serializeLatexVisualDocument(modelRef.current, currentEditor.getJSON());
      if (result.source === latestSourceRef.current) return;
      latestSourceRef.current = result.source;
      callbacksRef.current.onSourceChange(result.source);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (loadedDocumentRef.current === documentId && latestSourceRef.current === source) return;
    const nextModel = parseLatexVisualDocument(source, { mainDocument });
    const selection = editor.state.selection.from;
    modelRef.current = nextModel;
    latestSourceRef.current = source;
    loadedDocumentRef.current = documentId;
    editor.commands.setContent(
      { type: "doc", content: nextModel.content },
      { emitUpdate: false, errorOnInvalidContent: true },
    );
    editor.setEditable(!nextModel.readOnly);
    editor.commands.setTextSelection(Math.min(selection, editor.state.doc.content.size));
    setWarning(nextModel.warning);
    setActiveMath(null);
    setActiveCitation(null);
  }, [documentId, editor, mainDocument, source]);

  useEffect(() => () => editor?.destroy(), [editor]);

  const updateMath = useCallback((latex: string) => {
    if (!editor || !activeMath) return;
    if (activeMath.kind === "inlineMath") {
      editor.chain().updateInlineMath({ latex, pos: activeMath.pos }).run();
    } else if (activeMath.kind === "blockMath") {
      editor.chain().updateBlockMath({ latex, pos: activeMath.pos }).run();
    }
  }, [activeMath, editor]);

  const applyCitation = useCallback((keys: string[]) => {
    if (!editor) return;
    if (activeCitation) {
      editor.chain().setNodeSelection(activeCitation.pos).updateAttributes(activeCitation.kind, { keys }).run();
    } else {
      editor.chain().focus().insertContentAt(editor.state.selection.to, {
        type: "citation",
        attrs: { command: "\\cite", keys, raw: "", _commandPrefix: "\\cite", _sourceKeys: "" },
      }).run();
    }
    setActiveCitation(null);
  }, [activeCitation, editor]);

  const insertLatex = useCallback((value: string) => {
    if (!editor || modelRef.current.readOnly) return;
    try {
      editor.chain().focus().insertContent(parseLatexVisualFragment(value)).run();
    } catch {
      editor.chain().focus().insertContent({ type: "paragraph", content: [{ type: "text", text: value }] }).run();
    }
  }, [editor]);

  const getSelectedText = useCallback(() => {
    if (!editor || editor.state.selection.empty) return "";
    const content = editor.state.selection.content().content.toJSON() as VisualNode[];
    return serializeVisualFragment(content);
  }, [editor]);

  const activeMathNode = editor && activeMath ? editor.state.doc.nodeAt(activeMath.pos) : null;
  const activeCitationNode = editor && activeCitation ? editor.state.doc.nodeAt(activeCitation.pos) : null;

  return {
    editor,
    warning,
    activeMath,
    activeMathLatex: activeMathNode?.attrs.latex ?? "",
    activeCitation,
    activeCitationKeys: Array.isArray(activeCitationNode?.attrs.keys) ? activeCitationNode.attrs.keys : [],
    setActiveMath,
    setActiveCitation,
    updateMath,
    applyCitation,
    insertLatex,
    getSelectedText,
  };
}
