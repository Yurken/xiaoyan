import { useCallback, useMemo, useRef, useState } from "react";
import {
  CornerRightUp,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Loader2,
} from "lucide-react";
import type { DirEntry } from "./shared";
import type { CodeGitFile } from "../../lib/client";

type GitStatusKind = "modified" | "added" | "deleted" | "untracked" | "renamed";

interface CodeFileTreeProps {
  rootPath: string;
  entries: DirEntry[];
  loading: boolean;
  onListDir: (path: string) => Promise<DirEntry[]>;
  onOpenFile: (path: string, name: string) => void;
  activePath: string | null;
  gitFiles?: CodeGitFile[];
}

interface TreeNodeState {
  expanded: boolean;
  loading: boolean;
  children: DirEntry[];
}

const STATUS_PRIORITY: Record<GitStatusKind, number> = {
  deleted: 40,
  untracked: 30,
  added: 20,
  modified: 10,
  renamed: 5,
};

function normalizePath(p: string) {
  return p.replace(/\\/g, "/");
}

function getRelativePath(absolutePath: string, rootPath: string) {
  const root = normalizePath(rootPath).replace(/\/+$/, "");
  const abs = normalizePath(absolutePath);
  return abs.startsWith(root + "/") ? abs.slice(root.length + 1) : abs;
}

function getFileStatus(file: CodeGitFile): GitStatusKind | null {
  if (file.untracked) return "untracked";
  if (file.index_status === "D" || file.worktree_status === "D") return "deleted";
  if (file.index_status === "A" || file.worktree_status === "A") return "added";
  if (file.index_status === "R" || file.worktree_status === "R") return "renamed";
  if (file.index_status === "M" || file.worktree_status === "M") return "modified";
  return null;
}

function higherPriority(a: GitStatusKind | null, b: GitStatusKind | null): GitStatusKind | null {
  if (!a) return b;
  if (!b) return a;
  return STATUS_PRIORITY[a] >= STATUS_PRIORITY[b] ? a : b;
}

function buildStatusMap(gitFiles: CodeGitFile[] | undefined) {
  const map = new Map<string, GitStatusKind>();
  if (!gitFiles) return map;
  for (const file of gitFiles) {
    const status = getFileStatus(file);
    if (status) map.set(normalizePath(file.path), status);
  }
  return map;
}

function resolveStatus(
  entry: DirEntry,
  statusMap: Map<string, GitStatusKind>,
  rootPath: string,
  states: Map<string, TreeNodeState>,
): GitStatusKind | null {
  const rel = getRelativePath(entry.path, rootPath);
  const direct = statusMap.get(rel);
  if (direct) return direct;
  if (!entry.is_dir) return null;

  const state = states.get(entry.path);
  const prefix = rel === "" ? "" : `${rel}/`;

  // 已展开的目录：递归汇总子节点状态
  if (state?.expanded && state.children.length > 0) {
    let result: GitStatusKind | null = null;
    for (const child of state.children) {
      result = higherPriority(result, resolveStatus(child, statusMap, rootPath, states));
      if (result && STATUS_PRIORITY[result] >= 40) break;
    }
    return result;
  }

  // 未展开的目录：查找该目录下所有变更文件，取最高优先级
  let result: GitStatusKind | null = null;
  for (const [path, status] of statusMap) {
    if (path.startsWith(prefix)) {
      result = higherPriority(result, status);
      if (result && STATUS_PRIORITY[result] >= 40) break;
    }
  }
  return result;
}

export default function CodeFileTree({
  rootPath,
  entries,
  loading,
  onListDir,
  onOpenFile,
  activePath,
  gitFiles,
}: CodeFileTreeProps) {
  const [nodeStates, setNodeStates] = useState<Map<string, TreeNodeState>>(new Map());
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [currentEntries, setCurrentEntries] = useState<DirEntry[]>(entries);
  const [navLoading, setNavLoading] = useState(false);

  const gitStatusByPath = useMemo(() => buildStatusMap(gitFiles), [gitFiles]);

  // 当 rootPath 变化时重置导航状态
  const prevRootRef = useCallback(() => rootPath, [rootPath]);
  if (prevRootRef() !== rootPath) {
    setCurrentPath(rootPath);
    setCurrentEntries(entries);
  }

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

  // 获取父目录路径
  function getParentPath(p: string): string | null {
    const parts = p.replace(/[/\\]+$/, "").split(/[/\\]/);
    if (parts.length <= 1) return null;
    parts.pop();
    return parts.join("/");
  }

  // 导航到指定目录（替换当前视图为该目录内容）
  async function navigateTo(dirPath: string) {
    setNavLoading(true);
    try {
      const newEntries = await onListDir(dirPath);
      setCurrentPath(dirPath);
      setCurrentEntries(newEntries);
      setNodeStates(new Map());
    } finally {
      setNavLoading(false);
    }
  }

  const parentPath = getParentPath(currentPath);
  const displayEntries = currentPath === rootPath ? entries : currentEntries;
  const isLoading = currentPath === rootPath ? loading : navLoading;

  return (
    <div className="code-file-tree">
      <div className="code-file-tree__root">
        <div className="code-file-tree__root-left">
          <FolderOpen size={14} className="code-file-tree__root-icon" />
          <span className="code-file-tree__root-label" title={currentPath}>
            {currentPath.split(/[/\\]/).pop() || currentPath}
          </span>
        </div>
        {parentPath && (
          <button
            type="button"
            className="code-file-tree__parent"
            onClick={() => navigateTo(parentPath)}
            title={`返回上级：${parentPath}`}
          >
            <CornerRightUp size={14} />
          </button>
        )}
      </div>

      {isLoading && displayEntries.length === 0 ? (
        <div className="code-file-tree__loading">
          <Loader2 size={14} className="animate-spin" />
        </div>
      ) : (
        <div className="code-file-tree__list">
          {displayEntries.map((entry) => (
            <TreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              state={getState(entry.path)}
              activePath={activePath}
              onToggle={toggleExpand}
              onNavigate={navigateTo}
              onOpenFile={onOpenFile}
              onListDir={onListDir}
              nodeStates={nodeStates}
              getState={getState}
              gitStatusByPath={gitStatusByPath}
              rootPath={rootPath}
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
  onNavigate: (path: string) => void;
  onOpenFile: (path: string, name: string) => void;
  onListDir: (path: string) => Promise<DirEntry[]>;
  nodeStates: Map<string, TreeNodeState>;
  getState: (path: string) => TreeNodeState;
  gitStatusByPath: Map<string, GitStatusKind>;
  rootPath: string;
}

function TreeItem({
  entry,
  depth,
  state,
  activePath,
  onToggle,
  onNavigate,
  onOpenFile,
  onListDir,
  nodeStates,
  getState,
  gitStatusByPath,
  rootPath,
}: TreeItemProps) {
  const isActive = activePath === entry.path;
  const isDir = entry.is_dir;
  const gitStatus = useMemo(
    () => resolveStatus(entry, gitStatusByPath, rootPath, nodeStates),
    [entry, gitStatusByPath, rootPath, nodeStates],
  );
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    if (isDir) {
      // 单击延时执行，等待双击；双击时取消单击
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        onToggle(entry);
        clickTimerRef.current = null;
      }, 250);
    } else {
      onOpenFile(entry.path, entry.name);
    }
  }

  function handleDoubleClick() {
    if (!isDir) return;
    // 双击取消单击的展开，改为进入目录
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onNavigate(entry.path);
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
        className={`code-file-tree__item ${isActive ? "is-active" : ""} ${gitStatus ? `is-git-${gitStatus}` : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
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
              onNavigate={onNavigate}
              onOpenFile={onOpenFile}
              onListDir={onListDir}
              nodeStates={nodeStates}
              getState={getState}
              gitStatusByPath={gitStatusByPath}
              rootPath={rootPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
