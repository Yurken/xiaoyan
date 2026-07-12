import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { SavedSurvey } from "@research-copilot/types";
import { IS_MACOS_DESKTOP, MACOS_WINDOW_DRAG_HEIGHT } from "../../lib/windowChrome";
import SurveyCandidatePapersPanel from "./SurveyCandidatePapersPanel";
import SurveyReportContentPanel from "./SurveyReportContentPanel";
import { citationFormatLabel } from "./shared";
import { savedSurveyToStructured } from "./useSurveyHistory";

export default function SurveyHistoryDetailModal({
  survey,
  onClose,
}: {
  survey: SavedSurvey;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const structured = savedSurveyToStructured(survey);
  const fallbackLabel = citationFormatLabel(survey.citation_format ?? undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: visible ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0)", transition: "background 0.28s ease" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #F3F6FA 0%, var(--rc-surface) 100%)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          paddingTop: IS_MACOS_DESKTOP ? MACOS_WINDOW_DRAG_HEIGHT : 0,
        }}
      >
        <div
          className="flex flex-shrink-0 items-center justify-between px-6 py-4"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm text-ink-tertiary transition-colors hover:text-ink-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <span className="rc-accent-chip rounded-full px-2.5 py-0.5 text-[11px]">{fallbackLabel}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <p className="text-lg font-semibold text-ink-primary">{survey.query || "未命名综述"}</p>
            <p className="mt-1 text-xs text-ink-tertiary">
              {new Date(survey.created_at.replace(" ", "T") + "Z").toLocaleString("zh-CN")} · {structured.papers.length} 篇候选文献
            </p>
          </div>

          <SurveyReportContentPanel
            structured={structured}
            markdown={survey.markdown ?? ""}
            fallbackCitationFormatLabel={fallbackLabel}
          />

          <SurveyCandidatePapersPanel papers={structured.papers} />
        </div>
      </div>
    </div>
  );
}
