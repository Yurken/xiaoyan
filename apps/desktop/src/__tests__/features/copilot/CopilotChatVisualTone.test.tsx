import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "@research-copilot/ui";
import { CopilotChatArea } from "../../../features/copilot/CopilotChatArea";

describe("Copilot chat visual tone", () => {
  it("用户消息使用独立的柔和气泡样式，不再复用主按钮蓝色", () => {
    render(
      <CopilotChatArea
        messages={[{
          id: "user-1",
          role: "user",
          content: "思考不用做 card，极简样式",
          created_at: "2026-09-13T00:00:00Z",
        }]}
        chatMode="direct"
        agentRuns={[]}
        plan={[]}
        routingDecision={null}
        activeAssistantId={null}
        sending={false}
        searchingQuery={null}
        loadError=""
        editingMessageId={null}
        editText=""
        copiedId={null}
        onClearError={vi.fn()}
        onCopy={vi.fn()}
        onRetry={vi.fn()}
        onStartEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onEditTextChange={vi.fn()}
      />,
    );

    expect(screen.getByText("思考不用做 card，极简样式").parentElement).toHaveClass("rc-user-message");
  });

  it("代码块颜色由主题变量控制，并保留复制按钮", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { container } = render(
      <MarkdownRenderer content={"```bash\nconda --version\n```"} />,
    );

    const codeBlock = container.querySelector("pre");
    expect(codeBlock).toHaveStyle({
      background: "var(--rc-code-block-bg, #0B0F15)",
      color: "var(--rc-code-block-text, #E8EDF5)",
    });

    const copyButton = screen.getByRole("button", { name: "复制代码" });
    expect(copyButton).toHaveTextContent("");
    expect(copyButton).not.toHaveClass("border");
    expect(copyButton.style.background).toBe("");
    fireEvent.click(copyButton);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("conda --version"));
    expect(screen.getByRole("button", { name: "已复制代码" })).toHaveTextContent("");
  });
});
