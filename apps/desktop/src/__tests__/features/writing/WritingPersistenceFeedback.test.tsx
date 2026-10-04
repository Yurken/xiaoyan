import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WritingWorkspace from "../../../features/writing/WritingWorkspace";
import { getInvokeMock, resetInvokeMock } from "../../mocks/tauri";
import type { WritingDraft } from "../../../features/writing/shared";
import { getDefaultWritingTemplate } from "../../../features/writing/templates";
import { createDraftFromTemplate } from "../../../features/writing/draftFactory";

// 本用例验证实际工作区的保存反馈；PDF canvas 不属于此链路且 jsdom 没有 DOMMatrix。
vi.mock("../../../features/writing/WritingPreviewPanel", () => ({ default: () => null }));

describe("写作保存反馈", () => {
  beforeEach(() => { resetInvokeMock(); localStorage.clear(); });

  it("真实加载失败呈现重试入口，不展示可编辑的占位文稿", async () => {
    getInvokeMock().mockRejectedValue(new Error("文稿数据库不可访问"));
    render(<WritingWorkspace />);
    expect(await screen.findByRole("alert")).toHaveTextContent("文稿库加载失败：文稿数据库不可访问");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编译 PDF" })).not.toBeInTheDocument();
  });

  it("保存错误穿过实际工作区显示，重试成功后才显示自动保存", async () => {
    const draft: WritingDraft = createDraftFromTemplate(getDefaultWritingTemplate(), { id: "d1" });
    let failSaving = true;
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === "writing_draft_list") return [draft];
      if (command === "knowledge_list_interests") return [];
      if (command === "writing_draft_update") {
        if (failSaving) throw new Error("磁盘写入失败");
        return;
      }
      if (command === "writing_version_record") return { recorded: false, reason: "unchanged" };
      throw new Error(`Unexpected command: ${command}`);
    });
    render(<WritingWorkspace />);
    const notes = await screen.findByPlaceholderText("记录审稿要求、待补实验、下一轮修改计划...");
    fireEvent.change(notes, { target: { value: "新的分析" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("文稿尚未保存：磁盘写入失败");
    expect(screen.queryByText(/已自动保存/)).not.toBeInTheDocument();
    failSaving = false;
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText(/已自动保存/)).toBeInTheDocument();
    expect(notes).toHaveValue("新的分析");
  });
});
