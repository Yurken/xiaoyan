import { useState } from "react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReaderToolbar from "../../../features/reader/ReaderToolbar";
import ReaderZoomControl from "../../../features/reader/ReaderZoomControl";
import ReaderQaPanel from "../../../features/reader/ReaderQaPanel";
import { createReaderQaMessageId } from "../../../features/reader/useReaderQuestionAnswer";
import { createTextAnnotationRect } from "../../../features/reader/readerTextAnnotations";
import ReaderPaperList from "../../../features/reader/ReaderPaperList";
import ReaderSidebar from "../../../features/reader/ReaderSidebar";
import TextAnnotationInput from "../../../features/reader/TextAnnotationInput";
import type { AnnotationStyle, ReaderMode } from "../../../features/reader/readerTypes";
import { render, screen } from "../../helpers/render";

vi.mock("../../../features/papers/usePaperLibrarySnapshot", () => ({
  usePaperLibrarySnapshot: () => ({
    papers: [
      { id: "paper-1", title: "论文一", authors: "作者甲", year: 2025, file_path: "/paper-1.pdf" },
      { id: "paper-2", title: "论文二", authors: "作者乙", year: 2026, file_path: "/paper-2.pdf" },
    ],
    loading: false,
  }),
}));

function ToolbarHarness() {
  const [mode, setMode] = useState<ReaderMode>("view");
  const [tool, setTool] = useState<AnnotationStyle>("highlight");
  return (
    <ReaderToolbar
      leftOpen
      onToggleLeft={vi.fn()}
      onBack={vi.fn()}
      mode={mode}
      onModeChange={setMode}
      tool={tool}
      onToolChange={setTool}
      color="yellow"
      onColorChange={vi.fn()}
      fill={null}
      onFillChange={vi.fn()}
    />
  );
}

describe("reader annotations", () => {
  it("同一毫秒内生成的问答消息 ID 仍保持唯一", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    expect(createReaderQaMessageId("user")).not.toBe(createReaderQaMessageId("assistant"));
    now.mockRestore();
  });

  it("按文字输入框实际尺寸约束新批注位置", () => {
    const rect = createTextAnnotationRect(995, 1395, { left: 0, top: 0, width: 1000, height: 1400 });

    expect(rect.x + rect.w).toBeLessThanOrEqual(1);
    expect(rect.y + rect.h).toBeLessThanOrEqual(1);
    expect(rect.w).toBeCloseTo(0.192);
  });

  it("将文本和形状作为两个直接模式展示", async () => {
    const user = userEvent.setup();
    render(<ToolbarHarness />);

    expect(screen.queryByRole("button", { name: "批注" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "文本" }));
    expect(screen.getByTitle("添加文字")).toBeInTheDocument();
    expect(screen.queryByTitle("矩形框选")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "形状" }));
    expect(screen.getByTitle("矩形框选")).toBeInTheDocument();
    expect(screen.queryByTitle("添加文字")).not.toBeInTheDocument();
  });

  it("缩放控件从顶部工具栏拆出后仍可独立操作", async () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onScalePercentChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReaderZoomControl
        scalePercent={140}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onScalePercentChange={onScalePercentChange}
      />,
    );

    const input = screen.getByRole("textbox", { name: "缩放比例" });
    expect(input).toHaveValue("140");
    await user.click(input);
    await user.clear(input);
    await user.type(input, "175{Enter}");
    expect(onScalePercentChange).toHaveBeenCalledWith(175);
    await user.click(screen.getByTitle("放大"));
    await user.click(screen.getByTitle("缩小"));
    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
  });

  it("直接在原位文本框中编辑文字", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <TextAnnotationInput
        x={0.2}
        y={0.3}
        color="blue"
        initialContent="原文字"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "直接编辑后的文字");
    await user.click(screen.getByTitle("保存文字"));

    expect(onSubmit).toHaveBeenCalledWith("直接编辑后的文字");
  });

  it("以 Markdown 渲染论文问答回复", () => {
    render(
      <ReaderQaPanel
        width={320}
        currentPage={4}
        messages={[{
          id: "assistant-1",
          role: "assistant",
          content: "## 核心结论\n\n- **贡献一**\n- 贡献二",
          status: "done",
          page: 4,
        }]}
        sending={false}
        error=""
        onAsk={vi.fn()}
        onClear={vi.fn()}
        onCollapse={vi.fn()}
        onDragStart={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "核心结论" })).toBeInTheDocument();
    expect(screen.getByText("贡献一").tagName).toBe("STRONG");
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("缩略图可以在单栏与双栏间切换", async () => {
    const user = userEvent.setup();
    render(
      <ReaderSidebar
        width={260}
        currentPaperId="paper-1"
        onPaperSelect={vi.fn()}
        outline={[]}
        thumbnails={{ 1: "data:image/png;base64,a", 2: "data:image/png;base64,b" }}
        numPages={2}
        navigationLoading={false}
        navigationError=""
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        searchResults={[]}
        notes={[]}
        progress={{ page: 1, totalPages: 2, percent: 50, updatedAt: "" }}
        onPageSelect={vi.fn()}
        onNoteDelete={vi.fn()}
        onDragStart={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "页面" }));
    const grid = screen.getByAltText("第 1 页缩略图").closest("button")?.parentElement;
    expect(grid).toHaveClass("grid-cols-2");

    await user.click(screen.getByRole("button", { name: "单栏" }));
    expect(grid).toHaveClass("grid-cols-1");
  });

  it("目录为空时默认展示页面，并让删除批注始终可达", async () => {
    const onNoteDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ReaderSidebar
        width={260}
        currentPaperId="paper-1"
        onPaperSelect={vi.fn()}
        outline={[]}
        thumbnails={{ 1: "data:image/png;base64,a" }}
        numPages={1}
        navigationLoading={false}
        navigationError=""
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        searchResults={[]}
        notes={[{
          id: "note-1",
          paper_id: "paper-1",
          page: 1,
          content: "关键结论",
          style: "highlight",
          highlight_color: "yellow",
          fill_color: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }]}
        progress={{ page: 1, totalPages: 1, percent: 100, updatedAt: "" }}
        onPageSelect={vi.fn()}
        onNoteDelete={onNoteDelete}
        onDragStart={vi.fn()}
      />,
    );

    expect(await screen.findByAltText("第 1 页缩略图")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "批注" }));
    await user.click(screen.getByRole("button", { name: "删除第 1 页高亮批注" }));
    expect(onNoteDelete).toHaveBeenCalledWith("note-1");
  });

  it("论文列表不显示冗余标题，并将总数放在搜索框右侧", () => {
    render(<ReaderPaperList currentId="paper-1" onSelect={vi.fn()} embedded />);

    expect(screen.queryByText("论文库")).not.toBeInTheDocument();
    const search = screen.getByPlaceholderText("搜索标题/作者");
    expect(search.parentElement).toHaveTextContent("2");
  });

  it("搜索结果中高亮所有匹配词", async () => {
    const user = userEvent.setup();
    render(
      <ReaderSidebar
        width={260}
        currentPaperId="paper-1"
        onPaperSelect={vi.fn()}
        outline={[]}
        thumbnails={{}}
        numPages={1}
        navigationLoading={false}
        navigationError=""
        searchQuery="visual regions"
        onSearchQueryChange={vi.fn()}
        searchResults={[
          { page: 3, snippet: "The method combines text selection and visual regions.", score: 10 },
        ]}
        notes={[]}
        progress={{ page: 1, totalPages: 1, percent: 100, updatedAt: "" }}
        onPageSelect={vi.fn()}
        onNoteDelete={vi.fn()}
        onDragStart={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "搜索" }));
    const marks = screen.getAllByText(/visual|regions/i).filter((el) => el.tagName === "MARK");
    expect(marks).toHaveLength(2);
  });
});
