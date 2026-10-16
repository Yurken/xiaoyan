import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

interface WritingPdfExportFeedbackProps {
  saving: boolean;
  message: string;
  error: string;
  onRetry: () => void;
  className?: string;
}

export default function WritingPdfExportFeedback({
  saving,
  message,
  error,
  onRetry,
  className,
}: WritingPdfExportFeedbackProps) {
  if (!message && !error) return null;

  return (
    <div
      role={error ? "alert" : "status"}
      className={clsx("m-3 flex shrink-0 items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5", className)}
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      {saving && <Loader2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />}
      <p className={`min-w-0 flex-1 break-words ${error ? "text-apple-red" : "text-ink-secondary"}`}>
        {error || message}
      </p>
      {error && (
        <button
          type="button"
          className="shrink-0 font-medium text-apple-blue underline underline-offset-2"
          disabled={saving}
          onClick={onRetry}
        >
          重试保存
        </button>
      )}
    </div>
  );
}
