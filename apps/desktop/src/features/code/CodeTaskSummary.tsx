import { useEffect, useState } from "react";
import { formatCodeTaskDuration } from "./shared";

interface CodeTaskSummaryProps {
  durationMs?: number | null;
  startedAt?: number | null;
  running?: boolean;
}

export function CodeTaskSummary({ durationMs, startedAt, running = false }: CodeTaskSummaryProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running || !startedAt) return;
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [running, startedAt]);

  const elapsed = running && startedAt
    ? Math.max(0, now - startedAt)
    : durationMs;

  if (elapsed == null) return null;

  return (
    <div className="code-task-summary" aria-label={`${running ? "处理中" : "已完成"}，用时 ${formatCodeTaskDuration(elapsed)}`}>
      <span>{running ? "处理中" : "已完成"}</span>
      <span aria-hidden="true">·</span>
      <time>{running ? "已用 " : "用时 "}{formatCodeTaskDuration(elapsed)}</time>
    </div>
  );
}
