import { describe, it, expect } from "vitest";
import { interestFolderName } from "../../lib/interestUtils";

describe("interestFolderName", () => {
  it("优先使用 folder_name", () => {
    expect(interestFolderName({ folder_name: "我的文件夹", topic: "主题" })).toBe(
      "我的文件夹",
    );
  });

  it("folder_name 为空白时回退到 topic", () => {
    expect(interestFolderName({ folder_name: "   ", topic: "主题" })).toBe("主题");
  });

  it("无 folder_name 时回退到 topic", () => {
    expect(interestFolderName({ topic: "主题" })).toBe("主题");
  });
});
