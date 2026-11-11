import { useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PdfReaderViewerHandle } from "../../../features/reader/PdfReaderViewer";
import type { PaperNote, ReaderSelection } from "../../../features/reader/readerTypes";
import SelectionPopup from "../../../features/reader/SelectionPopup";
import { useReaderNotes } from "../../../features/reader/useReaderNotes";
import { useReaderNoteActions } from "../../../features/reader/notes/useReaderNoteActions";
import { useReaderNoteDocks } from "../../../features/reader/notes/useReaderNoteDocks";

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("../../../lib/client", () => ({ paperNotesApi: api }));
const selected: ReaderSelection = {
  text: "Original passage", page: 2, popupX: 200, popupY: 100,
  positions: [{ x: 0.1, y: 0.2, w: 0.2, h: 0.02 }],
};
const note: PaperNote = {
  id: "saved-note", paper_id: "paper-a", page: 2, content: "My draft", highlight_text: selected.text,
  style: "highlight", highlight_color: "yellow", fill_color: null, highlight_positions: selected.positions,
  created_at: "2026-11-11T00:00:00Z", updated_at: "2026-11-11T00:00:00Z",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function DockNoteHarness({ paperId = "paper-a", onClear }: { paperId?: string; onClear: () => void }) {
  const [selection, setSelection] = useState<ReaderSelection | null>(selected);
  const reader = useReaderNotes(paperId);
  const docks = useReaderNoteDocks({ navOpen: false, navWidth: 0, auxOpen: false, auxWidth: 0 });
  const viewerRef = useRef<PdfReaderViewerHandle>(null);
  const actions = useReaderNoteActions({
    paperId, notes: reader.notes, selection, docks, createAnnotation: reader.createAnnotation,
    deleteAnnotation: reader.deleteAnnotation, translation: null, viewerRef, flashToast: vi.fn(),
    clearSelection: () => { onClear(); setSelection(null); },
  });
  return <>
    <div data-testid="flash-note">{docks.flashNoteId}</div>
    <div data-testid="selection">{selection?.text}</div>
    <div data-testid="note-count">{actions.dockNoteCount}</div>
    <button onClick={() => setSelection({ ...selected, text: "Next passage" })}>Select another passage</button>
    <button onClick={() => docks.moveNote(note.id, "right")}>Move note right</button>
    <button onClick={() => void actions.handleDeleteNote(note)}>Delete dock note</button>
    <div data-testid="override">{docks.sideOverrides[note.id]}</div>
    {selection ? <SelectionPopup x={200} y={100} selectedText={selection.text} onAddNote={actions.handleAddNote} onTranslate={vi.fn()} onClose={() => setSelection(null)} /> : null}
  </>;
}
async function submitDraft() {
  fireEvent.click(screen.getByRole("button", { name: "笔记" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "My draft" } });
  fireEvent.click(screen.getByRole("button", { name: "存入笔记栏" }));
  await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
}

describe("dock note persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    api.list.mockResolvedValue([]);
    api.delete.mockResolvedValue(undefined);
  });

  it("keeps the source selection and popup draft after failure, then clears only after a successful retry", async () => {
    const first = deferred<PaperNote>();
    api.create.mockReturnValueOnce(first.promise).mockResolvedValueOnce(note);
    const onClear = vi.fn();
    render(<DockNoteHarness onClear={onClear} />);
    await submitDraft();
    expect(screen.getByRole("button", { name: "存入笔记栏" })).toBeDisabled();
    expect(onClear).not.toHaveBeenCalled();
    await act(async () => { first.reject(new Error("Disk unavailable")); });
    expect(screen.getByRole("textbox")).toHaveValue("My draft");
    expect(screen.getByTestId("selection")).toHaveTextContent(selected.text);
    expect(screen.getByRole("status")).toHaveTextContent("保存失败，草稿已保留");
    expect(screen.getByTestId("flash-note")).toBeEmptyDOMElement();
    expect(onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "存入笔记栏" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByTestId("note-count")).toHaveTextContent("1");
    expect(screen.getByTestId("flash-note")).toHaveTextContent(note.id);
  });

  it("does not clear a newer selection when an earlier note finishes saving", async () => {
    const saving = deferred<PaperNote>();
    api.create.mockReturnValueOnce(saving.promise);
    const onClear = vi.fn();
    render(<DockNoteHarness onClear={onClear} />);
    await submitDraft();
    fireEvent.click(screen.getByRole("button", { name: "Select another passage" }));
    await act(async () => { saving.resolve(note); });
    expect(screen.getByTestId("selection")).toHaveTextContent("Next passage");
    expect(onClear).not.toHaveBeenCalled();
  });

  it("keeps a manually chosen dock side when deleting a note fails", async () => {
    api.list.mockResolvedValue([note]);
    api.delete.mockRejectedValueOnce(new Error("Delete failed")).mockResolvedValueOnce(undefined);
    render(<DockNoteHarness onClear={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("note-count")).toHaveTextContent("1"));
    fireEvent.click(screen.getByRole("button", { name: "Move note right" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete dock note" })); });
    expect(screen.getByTestId("override")).toHaveTextContent("right");
    expect(screen.getByTestId("note-count")).toHaveTextContent("1");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete dock note" })); });
    expect(screen.getByTestId("override")).toBeEmptyDOMElement();
    expect(screen.getByTestId("note-count")).toHaveTextContent("0");
  });

  it("does not focus a saved note from a paper that has already been left", async () => {
    const saving = deferred<PaperNote>();
    api.create.mockReturnValueOnce(saving.promise);
    const onClear = vi.fn();
    const { rerender } = render(<DockNoteHarness paperId="paper-a" onClear={onClear} />);
    await submitDraft();
    rerender(<DockNoteHarness paperId="paper-b" onClear={onClear} />);
    await act(async () => { saving.resolve(note); });
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByTestId("flash-note")).toBeEmptyDOMElement();
    expect(screen.getByTestId("note-count")).toHaveTextContent("0");
  });
});
