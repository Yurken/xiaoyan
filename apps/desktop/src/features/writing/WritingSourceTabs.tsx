import { useState } from "react";
import { clsx } from "clsx";
import { Braces, FilePlus2, FileText, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@research-copilot/ui";
import RenameSavedEntryModal from "../../components/RenameSavedEntryModal";
import type { WritingEditorSource, WritingTexFile } from "./shared";
import { writingTexFileSource } from "./texFiles";
import WritingSourceFileContextMenu from "./WritingSourceFileContextMenu";

interface WritingSourceTabsProps {
  activeSource: WritingEditorSource;
  texFiles: WritingTexFile[];
  onActiveSourceChange: (source: WritingEditorSource) => void;
  onCreateTexFile: (path: string) => boolean;
  onRenameTexFile: (path: string, nextPath: string) => boolean;
  onDeleteTexFile: (path: string) => void;
}

export default function WritingSourceTabs({
  activeSource,
  texFiles,
  onActiveSourceChange,
  onCreateTexFile,
  onRenameTexFile,
  onDeleteTexFile,
}: WritingSourceTabsProps) {
  const [creating, setCreating] = useState(false);
  const [path, setPath] = useState("");
  const [fileMenu, setFileMenu] = useState<{ path: string; x: number; y: number } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);

  const cancelCreation = () => {
    setCreating(false);
    setPath("");
  };

  const createFile = () => {
    if (!path.trim()) {
      cancelCreation();
      return;
    }
    if (!onCreateTexFile(path)) return;
    cancelCreation();
  };

  const activeTexFile = texFiles.find((file) => writingTexFileSource(file.path) === activeSource);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      <SourceTab
        active={activeSource === "main"}
        icon={<FileText className="h-3.5 w-3.5" />}
        label="main.tex"
        onClick={() => onActiveSourceChange("main")}
      />
      {texFiles.map((file) => (
        <SourceTab
          key={file.path}
          active={activeSource === writingTexFileSource(file.path)}
          icon={<FileText className="h-3.5 w-3.5" />}
          label={file.path}
          onClick={() => onActiveSourceChange(writingTexFileSource(file.path))}
          onContextMenu={(event) => {
            event.preventDefault();
            setFileMenu({ path: file.path, x: event.clientX, y: event.clientY });
          }}
        />
      ))}
      <SourceTab
        active={activeSource === "bib"}
        icon={<Braces className="h-3.5 w-3.5" />}
        label="references.bib"
        onClick={() => onActiveSourceChange("bib")}
      />

      {creating ? (
        <form
          className="flex shrink-0 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            createFile();
          }}
        >
          <input
            autoFocus
            value={path}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              cancelCreation();
            }}
            onBlur={() => {
              if (!path.trim()) cancelCreation();
            }}
            placeholder="sections/intro.tex"
            aria-label="章节文件路径"
            className="h-7 w-40 rounded-lg border bg-transparent px-2 text-xs text-ink-primary outline-none placeholder:text-ink-tertiary/60"
            style={{ borderColor: "var(--rc-border)" }}
          />
          <button type="submit" className="h-7 rounded-lg px-2 text-[11px] font-semibold text-apple-blue hover:bg-apple-blue/10">
            添加
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="新建章节文件"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-apple-blue"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
        </button>
      )}

      {activeTexFile ? (
        <button
          type="button"
          onClick={() => setPendingDeletePath(activeTexFile.path)}
          title="移除当前章节文件"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-apple-red/10 hover:text-apple-red"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {fileMenu ? (
        <WritingSourceFileContextMenu
          {...fileMenu}
          onClose={() => setFileMenu(null)}
          onRename={() => {
            setRenamingPath(fileMenu.path);
            setFileMenu(null);
          }}
          onRequestDelete={() => {
            setPendingDeletePath(fileMenu.path);
            setFileMenu(null);
          }}
        />
      ) : null}

      <RenameSavedEntryModal
        open={renamingPath !== null}
        title="重命名章节文件"
        description="文件内容会保留；请使用相对 .tex 路径。"
        label="文件路径"
        initialValue={renamingPath ?? ""}
        placeholder="sections/introduction.tex"
        onClose={() => setRenamingPath(null)}
        onRename={(nextPath) => {
          if (!renamingPath) return false;
          return onRenameTexFile(renamingPath, nextPath);
        }}
      />

      <ConfirmDialog
        open={pendingDeletePath !== null}
        title="删除章节文件"
        description={`确定删除「${pendingDeletePath ?? ""}」吗？文件内容将从当前写作项目中移除。`}
        confirmLabel="删除"
        tone="danger"
        onClose={() => setPendingDeletePath(null)}
        onConfirm={() => {
          if (pendingDeletePath) onDeleteTexFile(pendingDeletePath);
          setPendingDeletePath(null);
        }}
      />
    </div>
  );
}

function SourceTab({
  active,
  icon,
  label,
  onClick,
  onContextMenu,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={label}
      className={clsx(
        "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-all",
        active ? "bg-apple-blue text-white shadow-sm" : "text-ink-tertiary hover:bg-white/5 hover:text-ink-secondary",
      )}
    >
      {icon}
      <span className="max-w-40 truncate">{label}</span>
    </button>
  );
}
