import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useReaderProgress } from "../../../features/reader/useReaderProgress";

describe("useReaderProgress", () => {
  beforeEach(() => localStorage.clear());

  it("按论文分别保存并恢复阅读断点", async () => {
    localStorage.setItem("xiaoyan:reader-progress:paper-a", JSON.stringify({
      page: 7,
      totalPages: 20,
      percent: 35,
      updatedAt: "2026-07-21T00:00:00.000Z",
    }));
    const { result, rerender } = renderHook(
      ({ paperId }) => useReaderProgress(paperId),
      { initialProps: { paperId: "paper-a" } },
    );

    expect(result.current.initialPage).toBe(7);
    rerender({ paperId: "paper-b" });
    await waitFor(() => expect(result.current.initialPage).toBe(1));

    act(() => result.current.recordProgress({ page: 3, totalPages: 12, percent: 25 }));
    expect(JSON.parse(localStorage.getItem("xiaoyan:reader-progress:paper-b") ?? "{}")).toMatchObject({
      page: 3,
      totalPages: 12,
      percent: 25,
    });
  });
});
