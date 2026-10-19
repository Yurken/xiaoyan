import { describe, expect, it } from "vitest";
import {
  parseWritingCompileSummary,
  type WritingCompileSummary,
} from "../../../features/writing/shared";

const compiled: WritingCompileSummary = {
  success: true,
  pdfPath: "/synthetic/compile/main.pdf",
  workDir: "/synthetic/compile",
  engine: "xelatex",
  log: "Compiled main.tex",
};

describe("parseWritingCompileSummary", () => {
  it.each([
    { name: "null", value: null },
    { name: "undefined", value: undefined },
    { name: "boolean", value: true },
    { name: "number", value: 1 },
    { name: "string", value: "compiled" },
    { name: "array", value: [] },
    { name: "empty object", value: {} },
  ])("拒绝 $name，不把 JSON 语法有效当作结果结构有效", ({ value }) => {
    expect(parseWritingCompileSummary(value)).toBeNull();
  });

  it.each(["success", "pdfPath", "workDir", "engine", "log"] as const)(
    "缺少 %s 字段时不恢复不完整结果",
    (field) => {
      const value: Record<string, unknown> = { ...compiled };
      delete value[field];
      expect(parseWritingCompileSummary(value)).toBeNull();
    },
  );

  it.each([
    { field: "success", value: "true" },
    { field: "pdfPath", value: 12 },
    { field: "workDir", value: null },
    { field: "engine", value: {} },
    { field: "log", value: ["Compiled"] },
  ])("$field 类型错误时不做隐式转换", ({ field, value }) => {
    expect(parseWritingCompileSummary({ ...compiled, [field]: value })).toBeNull();
  });

  it.each([
    { name: "成功", value: compiled },
    {
      name: "编译失败",
      value: { ...compiled, success: false, pdfPath: null, log: "Undefined control sequence" },
    },
    {
      name: "未安装编译器",
      value: { ...compiled, success: false, pdfPath: null, engine: "not-found", log: "未找到 LaTeX 编译器" },
    },
  ])("保留现有 v1 $name 结果的全部契约字段", ({ value }) => {
    expect(parseWritingCompileSummary(value)).toEqual(value);
  });

  it("兼容新引擎、平台路径与额外字段，只返回已校验的字段", () => {
    const known = {
      ...compiled,
      pdfPath: "C:\\合成文稿\\main.pdf",
      workDir: "C:\\合成文稿",
      engine: "future-engine",
    };
    const value = { ...known, diagnostics: { warnings: 1 } };
    expect(parseWritingCompileSummary(value)).toEqual(known);
    expect(value.diagnostics).toEqual({ warnings: 1 });
  });

  it("允许字符串为空，不把字段校验扩展成文件存在性检查", () => {
    const value = { success: false, pdfPath: "", workDir: "", engine: "", log: "" };
    expect(parseWritingCompileSummary(value)).toEqual(value);
  });

  it("保留成功标记但没有 PDF 的日志，交给现有编译分类处理", () => {
    const value = { ...compiled, pdfPath: null, log: "No output PDF" };
    expect(parseWritingCompileSummary(value)).toEqual(value);
  });
});
