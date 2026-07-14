import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchFieldBriefing } from "@research-copilot/types";
import { useFieldDynamics } from "../../features/field-dynamics/useFieldDynamics";

const mocks = vi.hoisted(() => ({
  listInterests: vi.fn(),
  scan: vi.fn(),
  list: vi.fn(),
  history: vi.fn(),
  importPaper: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock("../../lib/client", () => ({
  apiClient: {
    knowledge: { listInterests: mocks.listInterests },
    fieldDynamics: {
      scan: mocks.scan,
      list: mocks.list,
      history: mocks.history,
      importPaper: mocks.importPaper,
      markRead: mocks.markRead,
    },
  },
  formatErrorMessage: (error: unknown) => String(error),
}));

vi.mock("../../hooks/useDomainEventRefresh", () => ({
  useDomainEventRefresh: vi.fn(),
}));

function briefing(id: string, interestId: string): ResearchFieldBriefing {
  return {
    id,
    interest_id: interestId,
    interest_topic: interestId,
    period_start: "2026-07-01",
    period_end: "2026-07-14",
    summary: id,
    trends: [],
    key_papers: [],
    upcoming_deadlines: [],
    generated_at: "2026-07-14T08:00:00Z",
    is_read: false,
    stats: {
      candidate_paper_count: 0,
      selected_paper_count: 0,
      upcoming_deadline_count: 0,
      trend_count: 0,
    },
  };
}

describe("useFieldDynamics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listInterests.mockResolvedValue([]);
    mocks.history.mockResolvedValue({ briefings: [] });
    mocks.list.mockImplementation(async (interestId?: string) => ({
      briefings: interestId ? [briefing("filtered", interestId)] : [briefing("all", "interest-2")],
      unread_count: 1,
    }));
    mocks.scan.mockResolvedValue({
      briefings: [briefing("unfiltered-scan-result", "interest-2")],
      unread_count: 1,
      scanned_interests: 2,
    });
  });

  it("扫描后按当前研究兴趣重新加载简报", async () => {
    const { result } = renderHook(() => useFieldDynamics());
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(undefined));

    act(() => result.current.setInterestId("interest-1"));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith("interest-1"));

    await act(async () => {
      await result.current.scan();
    });

    expect(mocks.scan).toHaveBeenCalledWith(7, 10);
    expect(mocks.list).toHaveBeenLastCalledWith("interest-1");
    expect(result.current.briefings.map((item) => item.id)).toEqual(["filtered"]);
  });
});
