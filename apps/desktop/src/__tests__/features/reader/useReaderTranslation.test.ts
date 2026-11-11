import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReaderTranslation } from "../../../features/reader/useReaderTranslation";

const api = vi.hoisted(() => ({ get: vi.fn(), listModels: vi.fn(), translate: vi.fn(), chat: vi.fn() }));
vi.mock("../../../lib/client", () => ({
  settingsApi: { get: api.get, listModels: api.listModels },
  translateApi: { stream: api.translate }, chatApi: { stream: api.chat },
}));
const first = [{ x: 0.1, y: 0.2, w: 0.2, h: 0.02 }];
const second = [{ x: 0.6, y: 0.3, w: 0.2, h: 0.02 }];
const nextPage = [{ x: 0.1, y: 0.1, w: 0.2, h: 0.02 }];
async function setupTranslation() {
  const hook = renderHook(() => useReaderTranslation());
  await waitFor(() => expect(hook.result.current.loadingModels).toBe(false));
  return hook;
}

describe("translation note anchors", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockResolvedValue({ llm_provider: "openai", openai_chat_model: "test-model", translation_model: "test-model" });
    api.listModels.mockResolvedValue(["test-model"]);
    api.translate.mockImplementation(async function* () { yield { type: "delta", value: "译文" }; });
  });

  it("retains a selected passage's page positions through translation and source editing", async () => {
    const { result } = await setupTranslation();
    await act(async () => { result.current.translate("First sentence.", 2, first); });
    expect(result.current.current).toMatchObject({ page: 2, positions: first, status: "done" });
    await act(async () => { result.current.editSource("Edited sentence."); });
    expect(result.current.current).toMatchObject({ source: "Edited sentence.", page: 2, positions: first, status: "done" });
    expect(api.translate).toHaveBeenLastCalledWith("Edited sentence.", "zh", undefined, "test-model", expect.any(AbortSignal));
  });

  it("merges same-page anchors during continuous translation and keeps the original page anchor across pages", async () => {
    const { result } = await setupTranslation();
    await act(async () => { result.current.translate("First.", 2, first); });
    act(() => { result.current.setContinuous(true); });
    await act(async () => { result.current.translate("Second.", 2, second); });
    expect(result.current.current).toMatchObject({ source: "First. Second.", page: 2, positions: [...first, ...second] });
    await act(async () => { result.current.translate("Third.", 3, nextPage); });
    expect(result.current.current).toMatchObject({ source: "First. Second. Third.", page: 2, positions: [...first, ...second] });
    act(() => { result.current.setContinuous(false); });
    await act(async () => { result.current.translate("Fresh passage.", 3, nextPage); });
    expect(result.current.current).toMatchObject({ source: "Fresh passage.", page: 3, positions: nextPage });
  });
});
