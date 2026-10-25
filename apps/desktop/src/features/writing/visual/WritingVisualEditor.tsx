import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Braces } from "lucide-react";
import { EditorContent } from "@tiptap/react";
import type { WritingEditorHandle } from "../writingEditorHandle";
import { useWritingVisualEditor } from "./useWritingVisualEditor";
import WritingVisualToolbar from "./WritingVisualToolbar";
import WritingMathEditor from "./WritingMathEditor";
import WritingCitationPicker from "./WritingCitationPicker";
import "katex/dist/katex.min.css";
import "./visual-editor.css";

interface WritingVisualEditorProps {
  documentId: string;
  source: string;
  bibtex: string;
  referenceSource: string;
  mainDocument: boolean;
  onSourceChange: (source: string) => void;
  onEditSource: (raw: string, path?: string) => void;
  onInsertImage: () => void;
}

const WritingVisualEditor = forwardRef<WritingEditorHandle, WritingVisualEditorProps>(
  function WritingVisualEditor(props, ref) {
    const visual = useWritingVisualEditor(props);
    const [citationPickerOpen, setCitationPickerOpen] = useState(false);
    const propsRef = useRef(props);
    propsRef.current = props;

    useImperativeHandle(ref, () => ({
      focus: () => visual.editor?.commands.focus(),
      getSelectedText: visual.getSelectedText,
      insertText: (before, after = "") => visual.insertLatex(`${before}${visual.getSelectedText()}${after}`),
      insertLatex: visual.insertLatex,
      focusSourceRange: (start, end) => {
        const current = propsRef.current;
        current.onEditSource(current.source.slice(start, end ?? start));
      },
    }), [visual]);

    const closeMath = () => {
      visual.setActiveMath(null);
      visual.editor?.commands.focus();
    };
    const closeCitation = () => {
      setCitationPickerOpen(false);
      visual.setActiveCitation(null);
    };
    const pickerOpen = citationPickerOpen || visual.activeCitation !== null;

    return (
      <div className="writing-visual-workspace">
        <WritingVisualToolbar
          editor={visual.editor}
          disabled={Boolean(visual.warning)}
          onOpenCitation={() => {
            visual.setActiveMath(null);
            setCitationPickerOpen(true);
          }}
          onInsertImage={props.onInsertImage}
        />
        {visual.warning && (
          <div className="writing-visual-warning" role="alert">
            <Braces size={16} />
            <span>{visual.warning}</span>
            <button type="button" onClick={() => props.onEditSource("")}>打开源码</button>
          </div>
        )}
        {visual.activeMath && (
          <WritingMathEditor
            key={`${visual.activeMath.kind}:${visual.activeMath.pos}`}
            latex={visual.activeMathLatex}
            displayMode={visual.activeMath.kind === "blockMath"}
            onChange={visual.updateMath}
            onClose={closeMath}
          />
        )}
        {pickerOpen && (
          <WritingCitationPicker
            mode={visual.activeCitation?.kind === "reference" ? "reference" : "citation"}
            bibtex={props.bibtex}
            source={props.referenceSource}
            selectedKeys={visual.activeCitation ? visual.activeCitationKeys : []}
            onApply={(keys) => {
              visual.applyCitation(keys);
              setCitationPickerOpen(false);
              visual.editor?.commands.focus();
            }}
            onClose={closeCitation}
          />
        )}
        <EditorContent editor={visual.editor} className="writing-visual-editor" />
      </div>
    );
  },
);

export default WritingVisualEditor;
