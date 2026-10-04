import { useCallback, useEffect, useRef, useState } from "react";
import type { CodeTreeNodeState, DirEntry } from "./shared";

/** Directory navigation owns its results; child reads never mutate the workspace root list. */
export function useCodeFileTree(rootPath: string, readDir: (path: string) => Promise<DirEntry[]>) {
  const [nodeStates, setNodeStates] = useState<Map<string, CodeTreeNodeState>>(new Map());
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [currentEntries, setCurrentEntries] = useState<DirEntry[]>([]);
  const [navLoading, setNavLoading] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setCurrentPath(rootPath);
    setCurrentEntries([]);
    setNodeStates(new Map());
    setNavLoading(false);
    return () => { generation.current += 1; };
  }, [rootPath]);

  const getState = useCallback((path: string): CodeTreeNodeState => (
    nodeStates.get(path) ?? { expanded: false, loading: false, children: [] }
  ), [nodeStates]);

  const toggleExpand = useCallback(async (entry: DirEntry) => {
    if (!entry.is_dir) return;
    const current = getState(entry.path);
    if (current.expanded) {
      setNodeStates((previous) => new Map(previous).set(entry.path, { ...current, expanded: false }));
      return;
    }
    const requestGeneration = generation.current;
    setNodeStates((previous) => new Map(previous).set(entry.path, { ...current, loading: true, expanded: true }));
    const children = await readDir(entry.path);
    if (generation.current !== requestGeneration) return;
    setNodeStates((previous) => {
      const expanded = previous.get(entry.path)?.expanded ?? false;
      return new Map(previous).set(entry.path, { expanded, loading: false, children });
    });
  }, [getState, readDir]);

  const navigateTo = useCallback(async (path: string) => {
    const requestGeneration = ++generation.current;
    setNavLoading(true);
    try {
      const entries = await readDir(path);
      if (generation.current !== requestGeneration) return;
      setCurrentPath(path);
      setCurrentEntries(entries);
      setNodeStates(new Map());
    } finally {
      if (generation.current === requestGeneration) setNavLoading(false);
    }
  }, [readDir]);

  return { nodeStates, currentPath, currentEntries, navLoading, getState, toggleExpand, navigateTo };
}
