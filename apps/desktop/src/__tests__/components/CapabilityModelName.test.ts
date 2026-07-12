import { describe, expect, it } from "vitest";
import { toCapabilityModelName } from "@research-copilot/types";

describe("toCapabilityModelName", () => {
  it("应将综述流程运行时名称映射为设置中的标准模型名", () => {
    expect(toCapabilityModelName("检索规划 Agent")).toBe("探知模型");
    expect(toCapabilityModelName("文献检索 Agent")).toBe("溯源模型");
    expect(toCapabilityModelName("时序分析 Agent")).toBe("探知模型");
    expect(toCapabilityModelName("综述写作 Agent")).toBe("翰章模型");
  });

  it("应兼容规划流程中的历史别名", () => {
    expect(toCapabilityModelName("学习路径规划")).toBe("谋策模型");
    expect(toCapabilityModelName("参考文献筛选模型")).toBe("探知模型");
    expect(toCapabilityModelName("analyst")).toBe("洞见模型");
  });
});
