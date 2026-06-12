import { useCallback, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Loader2,
} from "lucide-react";
import type { DirEntry } from "./shared";

interface CodeFileTreeProps {
  rootPath: string;
  entries: DirEntry[];
  loading: boolean;
  onListDir: (path: string) => Promise<DirEntry[]>;
  onOpenFile: (path: string, name: string) => void;
  activePath: string | null;
}

interface TreeNodeState {
  expanded: boolean;
  loading: boolean;
  children: DirEntry[];
}

export default function CodeFileTree({
  rootPath,
  entries,
  loading,
  onListDir,
  onOpenFile,
  activePath,
}: CodeFileTreeProps) {
  const [nodeStates, setNodeStates] = useState<Map<string, TreeNodeState>>(new Map());

  const getState = useCallback(
    (path: string): TreeNodeState => {
      return (
        nodeStates.get(path) ?? {
          expanded: false,
          loading: false,
          children: [],
        }
      );
    },
    [nodeStates]
  );

  const toggleExpand = useCallback(
    async (entry: DirEntry) => {
      if (!entry.is_dir) return;
      const current = getState(entry.path);
      if (current.expanded) {
        setNodeStates((prev) => {
          const next = new Map(prev);
          next.set(entry.path, { ...current, expanded: false });
          return next;
        });
        return;
      }

      setNodeStates((prev) => {
        const next = new Map(prev);
        next.set(entry.path, { ...current, loading: true, expanded: true });
        return next;
      });

      const children = await onListDir(entry.path);

      setNodeStates((prev) => {
        const next = new Map(prev);
        next.set(entry.path, { expanded: true, loading: false, children });
        return next;
      });
    },
    [getState, onListDir]
  );

  return (
    <div className="code-file-tree">
      <div className="code-file-tree__root">
        <FolderOpen size={14} className="code-file-tree__root-icon" />
        <span className="code-file-tree__root-label" title={rootPath}>
          {rootPath.split(/[/\\]/).pop() || rootPath}
        </span>
      </div>

      {loading && entries.length === 0 ? (
        <div className="code-file-tree__loading">
          <Loader2 size={14} className="animate-spin" />
        </div>
      ) : (
        <div className="code-file-tree__list">
          {entries.map((entry) => (
            <TreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              state={getState(entry.path)}
              activePath={activePath}
              onToggle={toggleExpand}
              onOpenFile={onOpenFile}
              onListDir={onListDir}
              nodeStates={nodeStates}
              getState={getState}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TreeItemProps {
  entry: DirEntry;
  depth: number;
  state: TreeNodeState;
  activePath: string | null;
  onToggle: (entry: DirEntry) => void;
  onOpenFile: (path: string, name: string) => void;
  onListDir: (path: string) => Promise<DirEntry[]>;
  nodeStates: Map<string, TreeNodeState>;
  getState: (path: string) => TreeNodeState;
}

function TreeItem({
  entry,
  depth,
  state,
  activePath,
  onToggle,
  onOpenFile,
  onListDir,
  nodeStates,
  getState,
}: TreeItemProps) {
  const isActive = activePath === entry.path;
  const isDir = entry.is_dir;

  function handleClick() {
    if (isDir) {
      onToggle(entry);
    } else {
      onOpenFile(entry.path, entry.name);
    }
  }

  function getFileIcon() {
    if (isDir) {
      return state.expanded ? (
        <FolderOpen size={14} className="code-file-tree__icon-folder-open" />
      ) : (
        <Folder size={14} className="code-file-tree__icon-folder" />
      );
    }
    if (/\.(tsx?|jsx?|py|rs|go|java|c|cpp|h|hpp|cs)$/.test(entry.name)) {
      return <FileCode size={14} className="code-file-tree__icon-file-code" />;
    }
    return <FileText size={14} className="code-file-tree__icon-file" />;
  }

  return (
    <div>
      <button
        type="button"
        className={`code-file-tree__item ${isActive ? "is-active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
      >
        {isDir && (
          <span className="code-file-tree__chevron">
            {state.loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : state.expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </span>
        )}
        {!isDir && <span className="code-file-tree__chevron-placeholder" />}
        {getFileIcon()}
        <span className="code-file-tree__item-name">{entry.name}</span>
      </button>

      {isDir && state.expanded && state.children.length > 0 && (
        <div>
          {state.children.map((child) => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              state={getState(child.path)}
              activePath={activePath}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
              onListDir={onListDir}
              nodeStates={nodeStates}
              getState={getState}
            />
          ))}
        </div>
      )}
    </div>
  );
}
