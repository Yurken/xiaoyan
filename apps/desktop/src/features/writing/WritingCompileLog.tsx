import type { WritingCompileSummary } from "./shared";

export default function WritingCompileLog({ result }: { result: WritingCompileSummary }) {
  return (
    <details className="shrink-0 border-t px-3 py-2" style={{ borderColor: "var(--rc-border)" }}>
      <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-ink-tertiary hover:text-ink-secondary">
        <span className={`h-1.5 w-1.5 rounded-full ${result.success ? "bg-[#34C759]" : "bg-apple-red"}`} />
        编译日志 ({result.engine}) · {result.success ? "成功" : "失败"}
        <span className="ml-auto">展开</span>
      </summary>
      <pre className="rc-selectable mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-black/[0.06] p-2 font-mono text-[10px] leading-4 text-ink-secondary">
        {result.log || "没有编译日志。"}
      </pre>
    </details>
  );
}
