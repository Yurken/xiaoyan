import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSurveyGeneration } from "../../../features/knowledge/useSurveyGeneration";

const {
  mockListInterests,
  mockListPapers,
  mockClearSurveyRunSnapshot,
  mockUseActiveSurveyRunSnapshot,
  mockUseSurveyRunEventBridge,
} = vi.hoisted(() => ({
  mockListInterests: vi.fn(),
  mockListPapers: vi.fn(),
  mockClearSurveyRunSnapshot: vi.fn(),
  mockUseActiveSurveyRunSnapshot: vi.fn(),
  mockUseSurveyRunEventBridge: vi.fn(),
}));

vi.mock("../../../lib/client", () => ({
  apiClient: {
    knowledge: {
      listInterests: mockListInterests,
      createNote: vi.fn(),
    },
    papers: {
      list: mockListPapers,
    },
    survey: {
      generate: vi.fn(),
    },
    memory: {
      add: vi.fn(),
    },
  },
  formatErrorMessage: (error: unknown) => String(error ?? ""),
}));

vi.mock("../../../features/knowledge/useSurveyRunSnapshots", () => ({
  clearSurveyRunSnapshot: mockClearSurveyRunSnapshot,
  failSurveyRunSnapshot: vi.fn(),
  resumeSurveyRunSnapshot: vi.fn(),
  startSurveyRunSnapshot: vi.fn(),
  useActiveSurveyRunSnapshot: mockUseActiveSurveyRunSnapshot,
  useSurveyRunEventBridge: mockUseSurveyRunEventBridge,
}));

describe("useSurveyGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockListInterests.mockResolvedValue([
      { id: "interest-a", topic: "主题 A", folder_name: null },
      { id: "interest-b", topic: "主题 B", folder_name: null },
    ]);
    mockListPapers.mockResolvedValue([]);
    mockUseActiveSurveyRunSnapshot.mockReturnValue({
      requestId: "survey-1",
      status: "done",
      query: "旧综述主题",
      maxPapers: 20,
      litTypes: [],
      databases: [],
      citationFormat: "gbt7714",
      language: "both",
      selectedInterestId: "interest-a",
      paperIds: [],
      content: "# 旧综述",
      agents: [],
      structured: {
        query: "旧综述主题",
        report: {},
        papers: [],
      },
      updatedAt: Date.now(),
    });
  });

  it("切换研究主题时应清空当前综述结果并移出当前工作区", async () => {
    const { result } = renderHook(() => useSurveyGeneration());

    await waitFor(() => {
      expect(result.current.interests).toHaveLength(2);
      expect(result.current.content).toBe("# 旧综述");
    });

    act(() => {
      result.current.selectInterest("interest-b");
    });

    await waitFor(() => {
      expect(mockClearSurveyRunSnapshot).toHaveBeenCalledTimes(1);
      expect(result.current.query).toBe("主题 B");
      expect(result.current.content).toBe("");
      expect(result.current.structured).toBeNull();
      expect(result.current.hasResults).toBe(false);
    });
  });
});
