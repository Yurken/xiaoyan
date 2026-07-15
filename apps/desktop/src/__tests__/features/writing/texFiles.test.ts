import { describe, expect, it } from "vitest";
import { buildLatexProjectFiles } from "../../../features/writing/latexProject";
import {
  normalizeWritingTexFilePath,
  normalizeWritingTexFiles,
  resolveWritingProjectSource,
} from "../../../features/writing/texFiles";

describe("writing multi-file TeX helpers", () => {
  it("normalizes chapter paths and rejects unsafe paths", () => {
    expect(normalizeWritingTexFilePath(" sections\\introduction ")).toBe("sections/introduction.tex");
    expect(normalizeWritingTexFilePath("../introduction.tex")).toBeNull();
    expect(normalizeWritingTexFilePath("/tmp/introduction.tex")).toBeNull();
    expect(normalizeWritingTexFilePath("main.tex")).toBeNull();
  });

  it("expands nested input files for the in-app preview without recursing cycles", () => {
    const texFiles = normalizeWritingTexFiles([
      { path: "sections/method.tex", content: "方法正文\\input{sections/appendix}" },
      { path: "sections/appendix.tex", content: "附录正文\\input{sections/method}" },
    ]);

    expect(resolveWritingProjectSource("\\begin{document}\\input{sections/method}\\end{document}", texFiles)).toContain("附录正文");
    expect(resolveWritingProjectSource("\\input{sections/method}", texFiles)).toContain("\\input{sections/method}");
  });

  it("exports every chapter source alongside main.tex", () => {
    const files = buildLatexProjectFiles({
      projectName: "multi-file-paper",
      mainTex: "\\documentclass{article}\\begin{document}\\input{sections/intro}\\end{document}",
      bibtex: "",
      texFiles: [{ path: "sections/intro.tex", content: "引言正文" }],
      notes: "",
      imageAssets: [],
    }, "overleaf");

    expect(files).toContainEqual({ path: "sections/intro.tex", content: "引言正文\n" });
  });
});
