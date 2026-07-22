import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatStreamChunk } from "@research-copilot/types";
import { useCopilotChat } from "../../../features/copilot/useCopilotChat";

const { mockStream, mockMemoryAdd } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockMemoryAdd: vi.fn(),
}));

vi.mock("../../../lib/client", () => ({
  apiClient: {
    chat: { stream: mockStream },
    memory: { add: mockMemoryAdd },
    settings: { get: vi.fn() },
  },
  formatErrorMessage: (error: unknown) => String(error ?? ""),
}));

function createStreamThatStallsAfterDone() {
  const chunks: ChatStreamChunk[] = [
    { type: "request_id", value: "request-1" },
    { type: "done" },
  ];
  let index = 0;
  const iterator: AsyncIterableIterator<ChatStreamChunk> = {
    next: vi.fn(() => {
      const chunk = chunks[index++];
      return chunk
        ? Promise.resolve({ value: chunk, done: false })
        : new Promise<IteratorResult<ChatStreamChunk>>(() => undefined);
    }),
    return: vi.fn((): Promise<IteratorResult<ChatStreamChunk>> => (
      Promise.resolve({ value: undefined, done: true })
    )),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return iterator;
}

describe("useCopilotChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMemoryAdd.mockResolvedValue(undefined);
    mockStream.mockReturnValue(createStreamThatStallsAfterDone());
  });

  it("收到完成事件后立即恢复发送按钮，不等待流桥收尾", async () => {
    const { result } = renderHook(() => useCopilotChat({
      currentSession: null,
      selectedInterestId: "",
      chatMode: "direct",
      skills: [],
      selectedSkillId: null,
      attachments: [],
      clearAttachments: vi.fn(),
      onSessionCreated: vi.fn(),
    }));

    act(() => {
      result.current.setInput("测试完成状态");
    });

    await act(async () => {
      await result.current.handleSend();
    });

    await waitFor(() => {
      expect(result.current.sending).toBe(false);
    });
    expect(mockStream.mock.results[0]?.value.return).toHaveBeenCalledTimes(1);
  });

  it("发送阅读页交接消息时保留 paper 上下文", async () => {
    const { result } = renderHook(() => useCopilotChat({
      currentSession: null,
      selectedInterestId: "",
      contextType: "paper",
      contextId: "paper-1",
      chatMode: "direct",
      skills: [],
      selectedSkillId: null,
      attachments: [],
      clearAttachments: vi.fn(),
      onSessionCreated: vi.fn(),
    }));

    act(() => result.current.setInput("解释第 3 页"));
    await act(async () => result.current.handleSend());

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ context_type: "paper", context_id: "paper-1" }),
      expect.any(AbortSignal),
    );
  });
});
