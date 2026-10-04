import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useCodeModelOptions } from "../../features/code/useCodeModelOptions";

const settings = {
  llm_provider: "openai_compatible", openai_compatible_chat_model: "main-model",
  openai_chat_model: "another-provider", anthropic_chat_model: "claude-model",
  multi_agent_reproduction_model: "saved-code-model", paper_reproduction_model: "legacy-code-model",
};
beforeEach(() => {
  vi.mocked(invoke).mockImplementation(async (name) => {
    if (name === "settings_get") return settings;
    if (name === "settings_list_models") return ["main-model", "alternate-model"];
    if (name === "settings_update") return { ok: true, updated: [] };
    return undefined;
  });
});

describe("code model selection", () => {
  it("shows the persisted model even when remote discovery omits it", async () => {
    const hook = renderHook(() => useCodeModelOptions({ onToast: vi.fn() }));
    await waitFor(() => expect(hook.result.current.modelsLoading).toBe(false));
    await waitFor(() => expect(hook.result.current.currentModel).toBe("saved-code-model"));
    expect(hook.result.current.modelOptions.find((item) => item.id === hook.result.current.activeModelOptionId)?.model)
      .toBe("saved-code-model");
    await act(async () => { await hook.result.current.changeModelOption("openai_compatible:alternate-model"); });
    expect(hook.result.current.currentModel).toBe("alternate-model");
    expect(invoke).toHaveBeenCalledWith("settings_update", { data: {
      paper_reproduction_model: "alternate-model", multi_agent_reproduction_model: "alternate-model",
    } });
  });

  it("offers only models for the configured provider when discovery fails", async () => {
    vi.mocked(invoke).mockImplementation(async (name) => {
      if (name === "settings_get") return settings;
      if (name === "settings_list_models") throw new Error("离线");
      return undefined;
    });
    const hook = renderHook(() => useCodeModelOptions({ onToast: vi.fn() }));
    await waitFor(() => expect(hook.result.current.modelsError).toBe("离线"));
    expect(hook.result.current.modelOptions.map((option) => option.provider)).toEqual([
      "openai_compatible", "openai_compatible",
    ]);
    expect(hook.result.current.modelOptions.map((option) => option.model)).toEqual([
      "saved-code-model", "main-model",
    ]);
  });
});
