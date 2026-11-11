import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PdfReaderViewerHandle } from "../PdfReaderViewer";
import type { HighlightColor, NoteDockSide, PaperNote, ReaderSelection } from "../readerTypes";
import type { useReaderNotes } from "../useReaderNotes";
import type { TranslationState } from "../useReaderTranslation";
import {
  anchorPointOfRects, noteAnchorPoint, otherNoteDockSide, resolveDockSideForAnchor,
  resolveNoteDockSide, splitNoteDockNotes,
} from "./dockLayout";
import { useAutoHiddenFlag } from "./useAutoHiddenFlag";
import type { ReaderNoteDocks } from "./useReaderNoteDocks";

interface ReaderNoteActionsOptions {
  paperId: string | undefined;
  notes: PaperNote[];
  selection: ReaderSelection | null;
  docks: ReaderNoteDocks;
  createAnnotation: ReturnType<typeof useReaderNotes>["createAnnotation"];
  deleteAnnotation: ReturnType<typeof useReaderNotes>["deleteAnnotation"];
  translation: TranslationState | null;
  clearSelection: () => void;
  flashToast: (message: string) => void;
  viewerRef: RefObject<PdfReaderViewerHandle | null>;
}

/** Keep dock interactions and persistence success handling out of the composition page. */
export function useReaderNoteActions({
  paperId, notes, selection, docks, createAnnotation, deleteAnnotation,
  translation, clearSelection, flashToast, viewerRef,
}: ReaderNoteActionsOptions) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const currentRef = useRef({ paperId, selection });
  const mountedRef = useRef(true);
  useEffect(() => { currentRef.current = { paperId, selection }; }, [paperId, selection]);
  useEffect(() => { setActiveNoteId(null); }, [paperId]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const {
    visible: leftTicksVisible, reveal: revealLeftTicks, hold: holdLeftTicks, release: releaseLeftTicks,
  } = useAutoHiddenFlag();
  const {
    visible: rightTicksVisible, reveal: revealRightTicks, hold: holdRightTicks, release: releaseRightTicks,
  } = useAutoHiddenFlag();

  const dockNotes = useMemo(() => splitNoteDockNotes(notes, docks.sideOverrides), [notes, docks.sideOverrides]);
  const selectionSide = useMemo(() => resolveDockSideForAnchor(anchorPointOfRects(selection?.positions)), [selection]);
  const noteTickVisible = useMemo(() => ({
    left: docks.layout.modes.left === "collapsed" && leftTicksVisible,
    right: docks.layout.modes.right === "collapsed" && rightTicksVisible,
  }), [docks.layout.modes.left, docks.layout.modes.right, leftTicksVisible, rightTicksVisible]);

  const focusDockNote = useCallback((side: NoteDockSide, noteId: string) => {
    docks.expand(side);
    docks.flashNote(noteId);
    if (side === "left") revealLeftTicks();
    else revealRightTicks();
  }, [docks, revealLeftTicks, revealRightTicks]);

  const handleAddNote = useCallback(async (content: string, color: HighlightColor): Promise<boolean> => {
    if (!selection || !content.trim()) return false;
    const selected = selection;
    const side = resolveDockSideForAnchor(anchorPointOfRects(selected.positions));
    const saved = await createAnnotation({
      page: selected.page, highlightText: selected.text, color, style: "highlight",
      positions: selected.positions, content: content.trim(),
    }, (created) => {
      if (mountedRef.current && currentRef.current.paperId === paperId) focusDockNote(side, created.id);
    });
    // A failed write keeps both the popup draft and its source selection available for retry.
    // A later selection (or a different paper) must never be cleared by this older request.
    if (saved && mountedRef.current && currentRef.current.paperId === paperId && currentRef.current.selection === selected) clearSelection();
    return saved;
  }, [selection, paperId, createAnnotation, clearSelection, focusDockNote]);

  const handleSaveTranslationToDock = useCallback((side: NoteDockSide) => {
    if (!translation || translation.status !== "done" || !translation.result.trim()) return;
    void createAnnotation({
      page: translation.page ?? 1, highlightText: translation.source, color: "blue", style: "highlight",
      positions: translation.positions ?? [], content: translation.result.trim(),
    }, (created) => {
      if (!mountedRef.current || currentRef.current.paperId !== paperId) return;
      docks.moveNote(created.id, side);
      focusDockNote(side, created.id);
      flashToast(`已存入${side === "left" ? "左" : "右"}栏`);
    });
  }, [translation, paperId, createAnnotation, docks, focusDockNote, flashToast]);

  const handleMoveNoteSide = useCallback((note: PaperNote) => {
    const target = otherNoteDockSide(resolveNoteDockSide(note, docks.sideOverrides));
    docks.moveNote(note.id, target);
    focusDockNote(target, note.id);
  }, [docks, focusDockNote]);
  const handleNoteLocate = useCallback((note: PaperNote) => {
    viewerRef.current?.scrollToNote(note.page, noteAnchorPoint(note)?.y ?? 0);
    docks.flashNote(note.id);
  }, [docks, viewerRef]);
  const handleNoteTickClick = useCallback((note: PaperNote) => {
    focusDockNote(resolveNoteDockSide(note, docks.sideOverrides), note.id);
  }, [docks.sideOverrides, focusDockNote]);
  const handleHoverNote = useCallback((note: PaperNote | null) => {
    setActiveNoteId(note?.id ?? null);
    const side = note ? resolveNoteDockSide(note, docks.sideOverrides) : null;
    if (side === "left") { holdLeftTicks(); releaseRightTicks(); }
    else if (side === "right") { holdRightTicks(); releaseLeftTicks(); }
    else { releaseLeftTicks(); releaseRightTicks(); }
  }, [docks.sideOverrides, holdLeftTicks, releaseLeftTicks, holdRightTicks, releaseRightTicks]);
  const handleDeleteNote = useCallback(async (note: PaperNote) => {
    const saved = await deleteAnnotation(note.id);
    if (saved) docks.forgetNote(note.id);
    return saved;
  }, [docks, deleteAnnotation]);
  const handleCollapseDock = useCallback((side: NoteDockSide) => {
    docks.collapse(side);
    if (side === "left") revealLeftTicks();
    else revealRightTicks();
  }, [docks, revealLeftTicks, revealRightTicks]);
  const handleToggleNoteDocks = useCallback(() => {
    const next = !(docks.preferences.open.left || docks.preferences.open.right);
    docks.setOpen("left", next);
    docks.setOpen("right", next);
    if (!next) { revealLeftTicks(); revealRightTicks(); }
  }, [docks, revealLeftTicks, revealRightTicks]);

  return {
    activeNoteId, dockNotes, selectionSide, noteTickVisible,
    dockNoteCount: dockNotes.left.length + dockNotes.right.length,
    noteDocksOpen: docks.preferences.open.left || docks.preferences.open.right,
    holdLeftTicks, releaseLeftTicks, holdRightTicks, releaseRightTicks,
    handleAddNote, handleSaveTranslationToDock, handleMoveNoteSide, handleNoteLocate,
    handleNoteTickClick, handleHoverNote, handleDeleteNote, handleCollapseDock, handleToggleNoteDocks,
  };
}
