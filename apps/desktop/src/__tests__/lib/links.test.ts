import { describe, it, expect, vi, beforeEach } from "vitest";
import { open } from "@tauri-apps/plugin-shell";
import {
  normalizeDoi,
  buildDoiUrl,
  buildPaperSearchUrl,
  buildPaperUrl,
  openLink,
} from "../../lib/links";

describe("normalizeDoi", () => {
  it("空值返回 undefined", () => {
    expect(normalizeDoi(undefined)).toBeUndefined();
    expect(normalizeDoi(null)).toBeUndefined();
    expect(normalizeDoi("   ")).toBeUndefined();
  });

  it("剥离 doi.org 前缀", () => {
    expect(normalizeDoi("https://doi.org/10.1/x")).toBe("10.1/x");
    expect(normalizeDoi("http://doi.org/10.1/x")).toBe("10.1/x");
  });

  it("剥离 doi: 前缀", () => {
    expect(normalizeDoi("doi: 10.1/x")).toBe("10.1/x");
  });

  it("已规范化的 DOI 原样返回", () => {
    expect(normalizeDoi("10.1234/abc")).toBe("10.1234/abc");
  });
});

describe("buildDoiUrl", () => {
  it("有 DOI 时拼接 doi.org", () => {
    expect(buildDoiUrl("10.1/x")).toBe("https://doi.org/10.1/x");
  });
  it("无 DOI 返回 undefined", () => {
    expect(buildDoiUrl("")).toBeUndefined();
  });
});

describe("buildPaperSearchUrl", () => {
  it("对标题做 URL 编码", () => {
    expect(buildPaperSearchUrl("deep learning")).toBe(
      "https://www.semanticscholar.org/search?q=deep%20learning",
    );
  });
  it("空标题返回 undefined", () => {
    expect(buildPaperSearchUrl("  ")).toBeUndefined();
  });
});

describe("buildPaperUrl 优先级", () => {
  it("优先使用 href", () => {
    expect(
      buildPaperUrl({ href: "https://x.com", doi: "10.1/x", title: "t" }),
    ).toBe("https://x.com");
  });
  it("无 href 时用 DOI", () => {
    expect(buildPaperUrl({ doi: "10.1/x", title: "t" })).toBe(
      "https://doi.org/10.1/x",
    );
  });
  it("无 href/DOI 时退回标题搜索", () => {
    expect(buildPaperUrl({ title: "t" })).toBe(
      "https://www.semanticscholar.org/search?q=t",
    );
  });
  it("全空返回 undefined", () => {
    expect(buildPaperUrl({})).toBeUndefined();
  });
});

describe("openLink", () => {
  beforeEach(() => {
    vi.mocked(open).mockClear();
  });
  it("有效 URL 调用 shell.open", async () => {
    await openLink("https://x.com");
    expect(open).toHaveBeenCalledWith("https://x.com");
  });
  it("空 URL 不调用 open", async () => {
    await openLink("  ");
    expect(open).not.toHaveBeenCalled();
  });
});
