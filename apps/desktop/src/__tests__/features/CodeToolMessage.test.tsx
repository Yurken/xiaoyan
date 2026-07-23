import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeToolActionLine } from "../../features/code/CodeToolMessage";
import type { CodeToolCall, CodeToolResult } from "../../lib/client";

function makeCall(name: string, args: Record<string, unknown>): CodeToolCall {
  return {
    id: `call_${name}`,
    name,
    arguments: JSON.stringify(args),
  };
}

describe("CodeToolActionLine", () => {
  it("renders pending state when no result and not yet finished", () => {
    render(
      <CodeToolActionLine
        toolCall={makeCall("read_file", { file_path: "src/app.ts" })}
        pending
      />,
    );
    const node = screen.getByText("查看文件");
    expect(node).toBeInTheDocument();
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("查看文件").closest(".code-tool-action")).toHaveClass("is-pending");
  });

  it("renders ok state on success result", () => {
    const result: CodeToolResult = {
      tool_call_id: "call_read_file",
      name: "read_file",
      output: "file content",
      is_error: false,
    };
    const node = render(
      <CodeToolActionLine
        toolCall={makeCall("read_file", { file_path: "src/app.ts" })}
        result={result}
      />,
    );
    expect(node.container.querySelector(".code-tool-action")).toHaveClass("is-ok");
    expect(node.container.querySelector(".code-tool-action")).not.toHaveClass("is-error");
  });

  it("renders error state on failure result", () => {
    const result: CodeToolResult = {
      tool_call_id: "call_grep",
      name: "grep",
      output: "工具执行失败：未知工具：grep",
      is_error: true,
    };
    const node = render(
      <CodeToolActionLine
        toolCall={makeCall("grep", { pattern: "TODO", path: "src" })}
        result={result}
      />,
    );
    expect(node.container.querySelector(".code-tool-action")).toHaveClass("is-error");
    // 幻觉的工具名（不在 TOOL_VERBS 映射里）应回退到原名，避免误显示"搜索代码"
    expect(screen.getByText("grep")).toBeInTheDocument();
  });

  it("falls back gracefully when arguments fail to parse", () => {
    const toolCall: CodeToolCall = {
      id: "call_broken",
      name: "read_file",
      arguments: "not-json",
    };
    const node = render(<CodeToolActionLine toolCall={toolCall} />);
    // 解析失败也不会崩；只显示 verb，不显示 target
    expect(screen.getByText("查看文件")).toBeInTheDocument();
    expect(node.container.querySelector(".code-tool-action__target")).toBeNull();
  });

  it("uses different verb for each tool kind", () => {
    render(
      <CodeToolActionLine
        toolCall={makeCall("list_dir", { path: "." })}
      />,
    );
    expect(screen.getByText("列出目录")).toBeInTheDocument();

    render(
      <CodeToolActionLine
        toolCall={makeCall("run_command", { command: "pnpm test" })}
      />,
    );
    expect(screen.getByText("执行命令")).toBeInTheDocument();
    expect(screen.getByText("pnpm test")).toBeInTheDocument();
  });
});
