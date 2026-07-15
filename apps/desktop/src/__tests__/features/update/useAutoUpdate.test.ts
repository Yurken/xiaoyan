import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SKIPPED_UPDATE_VERSION_STORAGE_KEY } from "../../../features/update/shared";
import { useAutoUpdate } from "../../../lib/useAutoUpdate";

const updateMocks = vi.hoisted(() => ({
  check: vi.fn(),
  install: vi.fn(),
}));

vi.mock("../../../lib/client", () => ({
  formatErrorMessage: (error: unknown) => String(error),
  updatesApi: updateMocks,
}));

const availableUpdate = (version: string) => ({
  configured: true,
  available: true,
  currentVersion: "0.5.0",
  version,
});

describe("useAutoUpdate", () => {
  beforeEach(() => {
    localStorage.clear();
    updateMocks.check.mockReset();
    updateMocks.install.mockReset();
  });

  it("跳过当前版本后不再提示同版，但仍提示后续版本", async () => {
    updateMocks.check
      .mockResolvedValueOnce(availableUpdate("v0.5.1"))
      .mockResolvedValueOnce(availableUpdate("0.5.1"))
      .mockResolvedValueOnce(availableUpdate("0.5.2"));

    const firstCheck = renderHook(() => useAutoUpdate());
    await waitFor(() => expect(firstCheck.result.current.updateInfo?.version).toBe("v0.5.1"));

    act(() => firstCheck.result.current.skipVersion());

    expect(firstCheck.result.current.updateInfo).toBeNull();
    expect(localStorage.getItem(SKIPPED_UPDATE_VERSION_STORAGE_KEY)).toBe("0.5.1");
    firstCheck.unmount();

    const sameVersionCheck = renderHook(() => useAutoUpdate());
    await waitFor(() => expect(updateMocks.check).toHaveBeenCalledTimes(2));
    expect(sameVersionCheck.result.current.updateInfo).toBeNull();
    sameVersionCheck.unmount();

    const nextVersionCheck = renderHook(() => useAutoUpdate());
    await waitFor(() => expect(nextVersionCheck.result.current.updateInfo?.version).toBe("0.5.2"));
    nextVersionCheck.unmount();
  });
});
