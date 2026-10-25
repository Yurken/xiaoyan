import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { ChevronRight, Clipboard, FileCode2, History, ImagePlus, NotebookPen } from "lucide-react";
import { CapsuleTabs } from "@research-copilot/ui";
import type {
  WritingAssistantActionId,
  WritingEditorMode,
  WritingEditorSource,
  WritingImageAsset,
  WritingTexFile,
} from "./shared";
import type { WritingEditorHandle } from "./writingEditorHandle";
import WritingSourceEditor from "./WritingSourceEditor";
import WritingSourceTabs from "./WritingSourceTabs";
import WritingVisualEditor from "./visual/WritingVisualEditor";
import { findWritingTexFile, normalizeWritingTexFilePath, writingTexFileSource } from "./texFiles";
import "./WritingEditorPanel.css";

interface WritingEditorPanelProps {
  draftId: string;
  mainTex: string;
  bibtex: string;
  texFiles: WritingTexFile[];
  imageAssets: WritingImageAsset[];
  activeSource: WritingEditorSource;
  editorMode: WritingEditorMode;
  onEditorModeChange: (mode: WritingEditorMode) => void;
  onActiveSourceChange: (source: WritingEditorSource) => void;
  onSourceChange: (source: WritingEditorSource, value: string) => void;
  onCreateTexFile: (path: string) => boolean;
  onRenameTexFile: (path: string, nextPath: string) => boolean;
  onDeleteTexFile: (path: string) => void;
  onInsertImage: () => void;
  onAssistantAction: (actionId: WritingAssistantActionId) => void;
  onOpenVersionHistory?: () => void;
  sidebarCollapsed?: boolean;
  onExpandSidebar?: () => void;
}

const EDITOR_MODE_OPTIONS = [
  { value: "visual", label: "可视化", icon: <NotebookPen className="h-3.5 w-3.5" /> },
  { value: "source", label: "源码", icon: <FileCode2 className="h-3.5 w-3.5" /> },
] as const;

const WritingEditorPanel = forwardRef<WritingEditorHandle, WritingEditorPanelProps>(
  function WritingEditorPanel(props, ref) {
    const sourceRef = useRef<WritingEditorHandle>(null);
    const visualRef = useRef<WritingEditorHandle>(null);
    const showSource = props.editorMode === "source" || props.activeSource === "bib";
    const value = props.activeSource === "main"
      ? props.mainTex
      : props.activeSource === "bib"
        ? props.bibtex
        : findWritingTexFile(props.texFiles, props.activeSource)?.content ?? "";
    const valueRef = useRef(value);
    valueRef.current = value;
    const referenceSource = useMemo(
      () => [props.mainTex, ...props.texFiles.map((file) => file.content)].join("\n"),
      [props.mainTex, props.texFiles],
    );

    useImperativeHandle(ref, () => ({
      focus: () => (showSource ? sourceRef : visualRef).current?.focus(),
      getSelectedText: () => (showSource ? sourceRef : visualRef).current?.getSelectedText() ?? "",
      insertText: (before, after) => (showSource ? sourceRef : visualRef).current?.insertText(before, after),
      insertLatex: (content) => (showSource ? sourceRef : visualRef).current?.insertLatex(content),
      focusSourceRange: (start, end) => {
        props.onEditorModeChange("source");
        window.requestAnimationFrame(() => sourceRef.current?.focusSourceRange(start, end));
      },
    }));

    const editSource = (raw: string, path?: string) => {
      const normalized = path ? normalizeWritingTexFilePath(path) : null;
      if (normalized) props.onActiveSourceChange(writingTexFileSource(normalized));
      props.onEditorModeChange("source");
      if (!raw) return;
      window.requestAnimationFrame(() => {
        const index = valueRef.current.indexOf(raw);
        if (index >= 0) sourceRef.current?.focusSourceRange(index, index + raw.length);
      });
    };

    return (
      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
      >
        <div
          className="flex h-11 items-center gap-1 border-b px-2"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
        >
          {props.sidebarCollapsed && (
            <button
              type="button"
              onClick={props.onExpandSidebar}
              title="展开侧栏"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-primary"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <WritingSourceTabs
            activeSource={props.activeSource}
            texFiles={props.texFiles}
            onActiveSourceChange={props.onActiveSourceChange}
            onCreateTexFile={props.onCreateTexFile}
            onRenameTexFile={props.onRenameTexFile}
            onDeleteTexFile={props.onDeleteTexFile}
          />
          <div className="ml-auto flex shrink-0 items-center gap-2 px-1">
            <CapsuleTabs
              value={showSource ? "source" : "visual"}
              onChange={(mode) => {
                if (props.activeSource !== "bib") props.onEditorModeChange(mode as WritingEditorMode);
              }}
              options={EDITOR_MODE_OPTIONS}
              compact
            />
            {props.onOpenVersionHistory && (
              <button type="button" onClick={props.onOpenVersionHistory} title="历史版本" className="writing-editor-action">
                <History className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={props.onInsertImage} title="插入图片" className="writing-editor-action">
              <ImagePlus className="h-3.5 w-3.5" />
              {props.imageAssets.length > 0 && <span>{props.imageAssets.length}</span>}
            </button>
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(value); }}
              title="复制源码"
              className="writing-editor-action"
            >
              <Clipboard className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {showSource ? (
          <WritingSourceEditor
            key={props.activeSource}
            ref={sourceRef}
            value={value}
            onChange={(next) => props.onSourceChange(props.activeSource, next)}
            onInsertImage={props.onInsertImage}
            onAssistantAction={props.onAssistantAction}
          />
        ) : (
          <WritingVisualEditor
            ref={visualRef}
            documentId={`${props.draftId}:${props.activeSource}`}
            source={value}
            bibtex={props.bibtex}
            referenceSource={referenceSource}
            mainDocument={props.activeSource === "main"}
            onSourceChange={(next) => props.onSourceChange(props.activeSource, next)}
            onEditSource={editSource}
            onInsertImage={props.onInsertImage}
          />
        )}
      </section>
    );
  },
);

export default WritingEditorPanel;
