import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CopilotComposer from "../../../features/copilot/CopilotComposer";
import CopilotConversationWorkspace from "../../../features/copilot/welcome/CopilotConversationWorkspace";

function Conversation({ onSend }: { onSend: (text: string) => void }) {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);
  return <CopilotConversationWorkspace empty={!sent} draft={draft} onSuggestion={setDraft}
    chatArea={sent ? <p>已发送的消息</p> : null}
    composer={<CopilotComposer chatMode="direct" onChatModeChange={vi.fn()} input={draft} onInputChange={setDraft}
      onSubmit={() => { onSend(draft); setSent(true); setDraft(""); }} onCancel={vi.fn()} sending={false}
      uploadingAttachments={false} attachments={[]} onPasteImages={vi.fn()} removeAttachment={vi.fn()}
      skills={[]} selectedSkillId={null} onSelectedSkillChange={vi.fn()} skillLocked={false} onSkillLockedChange={vi.fn()} />}
  />;
}

describe("对话页融合欢迎输入区", () => {
  it("建议填入唯一的正式输入框，发送沿用当前对话，布局切换不重新挂载输入框", () => {
    const onSend = vi.fn();
    render(<Conversation onSend={onSend} />);
    const input = screen.getByRole("textbox");
    const text = "帮我把一个模糊的选题，变成可以验证的研究问题";
    fireEvent.click(screen.getByRole("button", { name: text }));
    expect(input).toHaveValue(text);
    expect(input).toHaveFocus();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "发送消息（⌘ / Ctrl + Enter）" }));
    expect(onSend).toHaveBeenCalledWith(text);
    expect(screen.getByText("已发送的消息")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "今天想弄清什么？" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "换一个建议" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBe(input);
  });
});
