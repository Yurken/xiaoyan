import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LINE_HEIGHT = 24;
const SCROLL_CONTEXT_LINES = 3;

interface UseWritingSourceSearchOptions {
  value: string;
  onChange: (next: string) => void;
  getEditor: () => HTMLTextAreaElement | null;
}

/**
 * 源码编辑器的查找/替换逻辑与搜索 UI 临时状态。
 * 挂载期间监听 Cmd/Ctrl+f 与 Escape；组件卸载时随 effect 清理，不影响可视化编辑器快捷键。
 */
export function useWritingSourceSearch({ value, onChange, getEditor }: UseWritingSourceSearchOptions) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const matches = useMemo(() => {
    if (!searchTerm) return [];
    const results: number[] = [];
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(value)) !== null) {
      results.push(m.index);
    }
    return results;
  }, [value, searchTerm]);

  const selectMatch = useCallback(
    (index: number) => {
      const el = getEditor();
      if (!el || matches.length === 0) return;
      const pos = matches[index % matches.length];
      const end = pos + searchTerm.length;
      el.focus();
      el.setSelectionRange(pos, end);
      const lineIndex = value.slice(0, pos).split("\n").length - 1;
      el.scrollTop = Math.max(0, (lineIndex - SCROLL_CONTEXT_LINES) * LINE_HEIGHT);
      setMatchIndex(index);
    },
    [getEditor, matches, searchTerm, value],
  );

  const navigateNext = useCallback(() => selectMatch(matchIndex + 1), [selectMatch, matchIndex]);
  const navigatePrev = useCallback(
    () => selectMatch(matchIndex - 1 + matches.length),
    [selectMatch, matchIndex, matches.length],
  );

  const replaceCurrent = useCallback(() => {
    if (matches.length === 0) return;
    const idx = matchIndex % matches.length;
    const pos = matches[idx];
    const next = value.slice(0, pos) + replaceTerm + value.slice(pos + searchTerm.length);
    onChange(next);
    setMatchIndex(idx);
  }, [matches, matchIndex, searchTerm, replaceTerm, value, onChange]);

  const replaceAll = useCallback(() => {
    if (matches.length === 0) return;
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    onChange(value.replaceAll(regex, replaceTerm));
  }, [matches.length, searchTerm, replaceTerm, value, onChange]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const closeSearch = useCallback(
    (refocus = true) => {
      setSearchOpen(false);
      setSearchTerm("");
      setReplaceTerm("");
      setShowReplace(false);
      if (refocus) {
        getEditor()?.focus();
      }
    },
    [getEditor],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape" && searchOpen) {
        e.preventDefault();
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, openSearch, closeSearch]);

  useEffect(() => {
    setMatchIndex(0);
  }, [searchTerm]);

  return {
    searchOpen,
    searchTerm,
    setSearchTerm,
    replaceTerm,
    setReplaceTerm,
    showReplace,
    setShowReplace,
    matchIndex,
    matches,
    searchInputRef,
    openSearch,
    closeSearch,
    navigateNext,
    navigatePrev,
    replaceCurrent,
    replaceAll,
  };
}
