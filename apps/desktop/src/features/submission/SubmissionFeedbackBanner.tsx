import { AlertCircle, X } from "lucide-react";

interface SubmissionFeedbackBannerProps {
  feedback: string;
  onDismiss: () => void;
}

export default function SubmissionFeedbackBanner({ feedback, onDismiss }: SubmissionFeedbackBannerProps) {
  if (!feedback) return null;

  return (
    <div className="flex-shrink-0 px-6 pt-4">
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
        style={{
          background: "color-mix(in srgb, var(--rc-elevated) 80%, var(--rc-danger, #FF3B30) 8%)",
          border: "1px solid color-mix(in srgb, var(--rc-danger, #FF3B30) 24%, var(--rc-border))",
          color: "var(--rc-danger, #B42318)",
        }}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span className="min-w-0 flex-1 break-all">{feedback}</span>
        <button
          type="button"
          aria-label="关闭提示"
          onClick={onDismiss}
          className="rounded-lg p-0.5 transition-colors hover:bg-apple-red/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
