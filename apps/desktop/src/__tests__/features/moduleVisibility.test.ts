import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MODULE_VISIBILITY,
  MODULE_VISIBILITY_STORAGE_KEY,
  normalizeModuleVisibility,
  persistModuleVisibility,
  readModuleVisibility,
} from "../../features/module-visibility/shared";

describe("模块显示设置", () => {
  beforeEach(() => localStorage.clear());

  it("旧配置缺少的新页签应默认显示", () => {
    const config = normalizeModuleVisibility({ tools: { arxiv: false } });
    expect(config.tools.arxiv).toBe(false);
    expect(config.tools.patent).toBe(true);
    expect(config.tools["document-check"]).toBe(true);
  });

  it("每组至少保留一个页签", () => {
    const config = normalizeModuleVisibility({
      experiment: { code: false, snapshots: false, records: false },
      tools: Object.fromEntries(Object.keys(DEFAULT_MODULE_VISIBILITY.tools).map((key) => [key, false])),
    });
    expect(config.experiment.records).toBe(true);
    expect(config.tools.arxiv).toBe(true);
  });

  it("可在本地持久化并恢复配置", () => {
    const config = normalizeModuleVisibility({ tools: { ppt: false } });
    persistModuleVisibility(config);
    expect(localStorage.getItem(MODULE_VISIBILITY_STORAGE_KEY)).toBeTruthy();
    expect(readModuleVisibility().tools.ppt).toBe(false);
  });
});
