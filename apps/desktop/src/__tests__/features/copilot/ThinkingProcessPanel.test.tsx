import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThinkingProcessPanel from "../../../features/copilot/ThinkingProcessPanel";

describe("ThinkingProcessPanel", () => {
  it("默认折叠思考内容，并以无卡片的轻量层级展开", () => {
    render(
      <ThinkingProcessPanel
        thought="先确认约束，再给出结论。"
        plan={[]}
        runs={[]}
        searchingQuery={null}
        isThinking={false}
      />,
    );

    const toggle = screen.getByRole("button", { name: "已思考" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("先确认约束，再给出结论。")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    const thought = screen.getByText("先确认约束，再给出结论。");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(thought.tagName).toBe("P");
    expect(thought).not.toHaveClass("rounded-xl");
  });
});
