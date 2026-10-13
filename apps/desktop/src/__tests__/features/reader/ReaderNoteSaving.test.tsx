import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PdfTextAnnotationLayer from "../../../features/reader/PdfTextAnnotationLayer";
import SelectionPopup from "../../../features/reader/SelectionPopup";

function deferred() { let resolve!: (value: boolean) => void; const promise = new Promise<boolean>((r) => { resolve = r; }); return { promise, resolve }; }

describe("reader note drafts", () => {
  it("keeps a new inline note and its text after a failed save, and closes only after retry succeeds", async () => {
    const first = deferred();
    const create = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(true);
    const { container } = render(<PdfTextAnnotationLayer page={1} pageSize={{ w: 600, h: 800 }} notes={[]} enabled color="yellow" onCreate={create} />);
    const target = container.querySelector('[style*="cursor: text"]');
    if (!target) throw new Error("Missing text annotation target");
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 600, height: 800 } as DOMRect);
    fireEvent.mouseDown(target, { clientX: 100, clientY: 100 });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "保留我的思考" } });
    fireEvent.click(screen.getByTitle("添加文字"));
    expect(screen.getByTitle("添加文字")).toBeDisabled();
    fireEvent.click(screen.getByTitle("添加文字"));
    expect(create).toHaveBeenCalledOnce();
    await act(async () => { first.resolve(false); });
    expect(screen.getByRole("textbox")).toHaveValue("保留我的思考");
    expect(screen.getByRole("status")).toHaveTextContent("草稿已保留");
    await act(async () => { fireEvent.click(screen.getByTitle("添加文字")); });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("Cmd/Ctrl Enter saves edited notes, with explicit pending and failure feedback", async () => {
    const result = deferred(); const update = vi.fn(() => result.promise);
    render(<SelectionPopup x={200} y={100} selectedText="source" mode="edit" noteContent="original" onUpdateNote={update} onTranslate={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "changed" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
    expect(update).toHaveBeenCalledWith("changed");
    expect(screen.getByRole("status")).toHaveTextContent("正在保存");
    await act(async () => { result.resolve(false); });
    expect(screen.getByRole("textbox")).toHaveValue("changed");
    expect(screen.getByRole("status")).toHaveTextContent("保存失败");
  });
});
