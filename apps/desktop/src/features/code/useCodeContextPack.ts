import { useMemo, useState } from "react";
import { codeApi, formatErrorMessage, type CodeWorkspaceContext } from "../../lib/client";

interface UseCodeContextPackOptions {
  workingDir?: string | null;
  currentFile?: string | null;
  onInputChange: (value: string) => void;
  onToast: (message: string) => void;
}

export function useCodeContextPack({
  workingDir,
  currentFile,
  onInputChange,
  onToast,
}: UseCodeContextPackOptions) {
  const [context, setContext] = useState<CodeWorkspaceContext | null>(null);
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    if (!context) return null;
    return {
      files: context.key_files.length,
      instructions: context.instruction_files.length,
      scripts: context.package_scripts.length,
      chars: context.content.length,
    };
  }, [context]);

  async function refreshContext() {
    if (!workingDir) {
      onToast("请先选择工作目录");
      return null;
    }

    setLoading(true);
    try {
      const next = await codeApi.workspaceContext(workingDir, currentFile ?? undefined);
      setContext(next);
      return next;
    } catch (err) {
      onToast(formatErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function injectContext() {
    const next = context ?? await refreshContext();
    if (!next) return;

    onInputChange(
      [
        "请基于下面的工作区上下文处理我的需求；最终回复保持简短，只说结果、验证和必要风险。",
        "",
        "<workspace-context>",
        next.content,
        "</workspace-context>",
        "",
      ].join("\n"),
    );
    onToast("已注入工作区上下文");
  }

  return {
    context,
    stats,
    loading,
    refreshContext,
    injectContext,
  };
}
