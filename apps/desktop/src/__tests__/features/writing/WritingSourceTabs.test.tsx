import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@testing-library/user-event";
import WritingSourceTabs from "../../../features/writing/WritingSourceTabs";
import { fireEvent, render, screen } from "../../helpers/render";

describe("WritingSourceTabs", () => {
  it("空名称提交时直接取消新建，不创建章节文件", async () => {
    const onCreateTexFile = vi.fn(() => true);
    const user = userEvent.setup();

    render(
      <WritingSourceTabs
        activeSource="main"
        texFiles={[]}
        onActiveSourceChange={vi.fn()}
        onCreateTexFile={onCreateTexFile}
        onRenameTexFile={vi.fn(() => true)}
        onDeleteTexFile={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("新建章节文件"));
    expect(screen.getByRole("textbox", { name: "章节文件路径" })).toBeInTheDocument();
    await user.keyboard("{Enter}");

    expect(onCreateTexFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "章节文件路径" })).not.toBeInTheDocument();
  });

  it("空名称失焦时自动取消新建", async () => {
    const user = userEvent.setup();

    render(
      <WritingSourceTabs
        activeSource="main"
        texFiles={[]}
        onActiveSourceChange={vi.fn()}
        onCreateTexFile={vi.fn(() => true)}
        onRenameTexFile={vi.fn(() => true)}
        onDeleteTexFile={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("新建章节文件"));
    await user.tab();

    expect(screen.queryByRole("textbox", { name: "章节文件路径" })).not.toBeInTheDocument();
  });

  it("右键菜单可以重命名章节文件", async () => {
    const onRenameTexFile = vi.fn(() => true);
    const user = userEvent.setup();

    render(
      <WritingSourceTabs
        activeSource="tex:sections/intro.tex"
        texFiles={[{ path: "sections/intro.tex", content: "正文" }]}
        onActiveSourceChange={vi.fn()}
        onCreateTexFile={vi.fn(() => true)}
        onRenameTexFile={onRenameTexFile}
        onDeleteTexFile={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "sections/intro.tex" }), { clientX: 100, clientY: 120 });
    await user.click(screen.getByRole("menuitem", { name: "重命名" }));
    const input = screen.getByRole("textbox", { name: "文件路径" });
    await user.clear(input);
    await user.type(input, "sections/method.tex");
    await user.click(screen.getByRole("button", { name: "保存名称" }));

    expect(onRenameTexFile).toHaveBeenCalledWith("sections/intro.tex", "sections/method.tex");
  });

  it("右键删除章节文件前要求确认", async () => {
    const onDeleteTexFile = vi.fn();
    const user = userEvent.setup();

    render(
      <WritingSourceTabs
        activeSource="tex:sections/intro.tex"
        texFiles={[{ path: "sections/intro.tex", content: "正文" }]}
        onActiveSourceChange={vi.fn()}
        onCreateTexFile={vi.fn(() => true)}
        onRenameTexFile={vi.fn(() => true)}
        onDeleteTexFile={onDeleteTexFile}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "sections/intro.tex" }), { clientX: 100, clientY: 120 });
    await user.click(screen.getByRole("menuitem", { name: "删除" }));

    expect(onDeleteTexFile).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "删除章节文件" });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(onDeleteTexFile).toHaveBeenCalledWith("sections/intro.tex");
  });
});
