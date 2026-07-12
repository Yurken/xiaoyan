import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, NotebookPen, ScrollText } from "lucide-react";
import { CapsuleTabs, Card, MarkdownRenderer } from "@research-copilot/ui";
import { openLink } from "../../lib/links";
import {
  buildSurveyMarkdownPreview,
  type StructuredSurveyResult,
} from "./shared";
import SurveyStructuredReport from "./SurveyStructuredReport";

type SurveyContentView = "structured" | "markdown";

interface SurveyReportContentPanelProps {
  structured: StructuredSurveyResult | null;
  markdown: string;
  generating?: boolean;
  fallbackCitationFormatLabel: string;
}

const CONTENT_TABS: Array<{ value: SurveyContentView; label: string; icon: ReactNode }> = [
  { value: "structured", label: "结构化综述", icon: <NotebookPen className="h-3.5 w-3.5" /> },
  { value: "markdown", label: "Markdown 原稿", icon: <ScrollText className="h-3.5 w-3.5" /> },
];

export default function SurveyReportContentPanel({
  structured,
  markdown,
  generating = false,
  fallbackCitationFormatLabel,
}: SurveyReportContentPanelProps) {
  const hasStructured = Boolean(structured);
  const hasMarkdown = Boolean(markdown?.trim());
  const hadStructuredRef = useRef(hasStructured);
  const [view, setView] = useState<SurveyContentView>(hasStructured ? "structured" : "markdown");

  useEffect(() => {
    if (!hasStructured && view === "structured") {
      setView("markdown");
      hadStructuredRef.current = false;
      return;
    }
    if (hasStructured && !hadStructuredRef.current) {
      setView("structured");
    }
    hadStructuredRef.current = hasStructured;
  }, [hasStructured, view]);

  const markdownPreview = useMemo(() => buildSurveyMarkdownPreview(markdown), [markdown]);
  const showTabs = hasStructured && hasMarkdown;

  return (
    <div className="space-y-3">
      {showTabs ? (
        <Card padding="sm" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CapsuleTabs
              compact
              options={CONTENT_TABS}
              value={view}
              onChange={(next) => setView(next as SurveyContentView)}
            />
            <p className="text-[11px] text-ink-tertiary">默认优先展示结构化综述，避免候选论文与参考文献重复占用阅读空间。</p>
          </div>
        </Card>
      ) : null}

      {view === "structured" && structured ? (
        <SurveyStructuredReport structured={structured} fallbackCitationFormatLabel={fallbackCitationFormatLabel} />
      ) : null}

      {view === "markdown" && markdownPreview.content ? (
        <Card padding="sm">
          <MarkdownRenderer content={markdownPreview.content} onLinkClick={openLink} />
          {markdownPreview.appendixHidden ? (
            <p className="mt-3 rounded-2xl border border-nm-dark/8 bg-white/55 px-3 py-2 text-[11px] leading-5 text-ink-tertiary">
              预览里已隐藏候选论文与参考文献附录；复制或保存时仍会保留完整 Markdown。
            </p>
          ) : null}
          {generating ? (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-tertiary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              生成中…
            </div>
          ) : null}
        </Card>
      ) : null}

      {!markdownPreview.content && !structured && generating ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
          <p className="text-sm text-ink-tertiary">正在检索文献并生成综述…</p>
        </Card>
      ) : null}
    </div>
  );
}
