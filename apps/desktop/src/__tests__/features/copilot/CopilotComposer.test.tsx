import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "../../helpers/render";
import CopilotComposer from "../../../features/copilot/CopilotComposer";

function renderComposer(overrides: Partial<ComponentProps<typeof CopilotComposer>> = {}) {
  const props = {
    chatMode: "direct" as const,
    onChatModeChange: vi.fn(),
    input: "请总结这篇论文",
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    sending: false,
    uploadingAttachments: false,
    attachments: [],
    onPasteImages: vi.fn(),
    removeAttachment: vi.fn(),
    skills: [],
    selectedSkillId: null,
    onSelectedSkillChange: vi.fn(),
    skillLocked: false,
    onSkillLockedChange: vi.fn(),
    ...overrides,
  };

  render(<CopilotComposer {...props} />);
  return props;
}

describe("CopilotComposer", () => {
  it("仅在 Cmd 或 Ctrl 加 Enter 时发送，普通 Enter 保留为换行", () => {
    const props = renderComposer();
    const input = screen.getByRole("textbox");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(props.onSubmit).toHaveBeenCalledTimes(2);
  });

  it("生成中将发送按钮替换为终止按钮", () => {
    const props = renderComposer({ sending: true });

    fireEvent.click(screen.getByRole("button", { name: "终止生成" }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
