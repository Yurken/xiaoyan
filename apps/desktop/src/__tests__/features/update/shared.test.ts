import { describe, expect, it } from "vitest";
import { isUpdateVersionSkipped, normalizeUpdateVersion } from "../../../features/update/shared";

describe("update shared", () => {
  it("比较版本时兼容 v 前缀与首尾空格", () => {
    expect(normalizeUpdateVersion(" v0.5.1 ")).toBe("0.5.1");
    expect(isUpdateVersionSkipped("v0.5.1", "0.5.1")).toBe(true);
  });

  it("只跳过记录的版本，后续版本仍可提示", () => {
    expect(isUpdateVersionSkipped("0.5.1", "0.5.1")).toBe(true);
    expect(isUpdateVersionSkipped("0.5.2", "0.5.1")).toBe(false);
  });
});
