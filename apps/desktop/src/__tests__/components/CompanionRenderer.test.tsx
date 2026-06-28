import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, userEvent, waitFor } from "../helpers/render";
import { getInvokeMock, mockInvoke, resetInvokeMock } from "../mocks/tauri";
import CompanionRenderer from "../../features/companion/CompanionRenderer";

const mockFinding = {
  id: "finding-1",
  interest_id: "interest-1",
  interest_topic: "多模态学习",
  arxiv_id: "2401.00001",
  title: "A Relevant Paper",
  authors: "Author A, Author B",
  published_at: "2026-06-28",
  abs_url: "https://arxiv.org/abs/2401.00001",
  pdf_url: "https://arxiv.org/pdf/2401.00001",
  relevance_score: 92,
  relevance_reason: "与你当前关注的主题高度相关。",
  abstract_snippet: "Test abstract",
  scanned_at: "2026-06-28T08:00:00Z",
  is_read: false,
};

describe("CompanionRenderer", () => {
  beforeEach(() => {
    resetInvokeMock();
    mockInvoke({
      settings_get: { xiaoyan_companion_id: "xiaoyan" },
      active_researcher_findings: {
        findings: [mockFinding],
        unread_count: 1,
      },
      active_researcher_import_finding: {
        paper_id: "paper-1",
        title: mockFinding.title,
        finding_id: mockFinding.id,
      },
    });
  });

  it("inline 小妍应能打开并重新打开论文抽屉", async () => {
    render(<CompanionRenderer inline />);

    const trigger = await waitFor(() =>
      screen.getByRole("button", { name: "查看小妍找到的论文" }),
    );

    await userEvent.click(trigger);
    expect(await screen.findByText("小妍帮你找到了 1 篇论文")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "关闭论文抽屉" }));
    await waitFor(() => {
      expect(screen.queryByText("小妍帮你找到了 1 篇论文")).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "查看小妍找到的论文" }));
    expect(await screen.findByText("小妍帮你找到了 1 篇论文")).toBeInTheDocument();
  });

  it("应支持下载并导入 arXiv 论文，并移除冗余查看按钮", async () => {
    render(<CompanionRenderer inline />);

    await userEvent.click(await waitFor(() =>
      screen.getByRole("button", { name: "查看小妍找到的论文" }),
    ));

    expect(screen.queryByRole("link", { name: "在 arXiv 查看" })).not.toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", { name: `下载并导入 ${mockFinding.title}` }),
    );

    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith("active_researcher_import_finding", {
        id: mockFinding.id,
      });
    });
    expect(await screen.findByText(`已导入《${mockFinding.title}》`)).toBeInTheDocument();
  });
});
