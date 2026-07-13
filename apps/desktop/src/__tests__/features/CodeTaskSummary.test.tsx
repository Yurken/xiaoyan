import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { render, screen } from "../helpers/render";
import { CodeTaskSummary } from "../../features/code/CodeTaskSummary";
import CodeChatPanel from "../../features/code/CodeChatPanel";
import { formatCodeTaskDuration } from "../../features/code/shared";

describe("CodeTaskSummary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats completed task duration in a Codex-style summary", () => {
    render(<CodeTaskSummary durationMs={191_000} />);

    expect(screen.getByLabelText("已完成，用时 3m 11s")).toHaveTextContent("已完成·用时 3m 11s");
  });

  it("formats short durations without a minute segment", () => {
    expect(formatCodeTaskDuration(800)).toBe("0s");
    expect(formatCodeTaskDuration(59_900)).toBe("59s");
  });

  it("updates the elapsed time while a task is streaming", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    render(<CodeTaskSummary startedAt={Date.now()} running />);

    expect(screen.getByLabelText("处理中，用时 0s")).toHaveTextContent("处理中·已用 0s");

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByLabelText("处理中，用时 3s")).toHaveTextContent("处理中·已用 3s");
  });

  it("shows the persisted duration below a completed assistant response", () => {
    render(
      <CodeChatPanel
        messages={[{
          id: "assistant-1",
          role: "assistant",
          content: "脚本已更新，并完成验证。",
          duration_ms: 191_000,
          created_at: "2026-07-13T00:00:00.000Z",
        }]}
        streamingContent=""
        sending={false}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        currentFileName={null}
        currentModel="deepseek-chat"
        modelOptions={[]}
        activeModelOptionId=""
        onModelOptionChange={vi.fn()}
      />,
    );

    expect(screen.getByText("脚本已更新，并完成验证。")).toBeInTheDocument();
    expect(screen.getByLabelText("已完成，用时 3m 11s")).toBeInTheDocument();
  });
});
