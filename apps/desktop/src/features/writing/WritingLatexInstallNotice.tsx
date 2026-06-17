import { Download, ExternalLink, Terminal } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { LATEX_INSTALL_SUPPORT } from "./shared";

interface WritingLatexInstallNoticeProps {
  openingInstaller: boolean;
  onDownloadInstaller: () => void;
  onOpenInstallGuide: () => void;
}

export default function WritingLatexInstallNotice({
  openingInstaller,
  onDownloadInstaller,
  onOpenInstallGuide,
}: WritingLatexInstallNoticeProps) {
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3"
      style={{ background: "rgba(255,149,0,0.08)", borderColor: "rgba(255,149,0,0.24)" }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FF9500]/15 text-[#B95E00]">
          <Terminal className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-xs leading-5 text-ink-secondary">
          <p className="font-semibold text-ink-primary">未找到 LaTeX 编译器</p>
          <p>
            {LATEX_INSTALL_SUPPORT.description}
            {LATEX_INSTALL_SUPPORT.paths.length > 0 ? " 常见路径：" : null}
            {LATEX_INSTALL_SUPPORT.paths.map((path, index) => (
              <span key={path}>
                {index > 0 ? " / " : null}
                <span className="rc-selectable font-mono">{path}</span>
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {LATEX_INSTALL_SUPPORT.primaryActionLabel ? (
          <Button
            type="button"
            size="sm"
            onClick={onDownloadInstaller}
            loading={openingInstaller}
          >
            <Download className="h-3.5 w-3.5" />
            {LATEX_INSTALL_SUPPORT.primaryActionLabel}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={onOpenInstallGuide}>
          <ExternalLink className="h-3.5 w-3.5" />
          {LATEX_INSTALL_SUPPORT.secondaryActionLabel}
        </Button>
      </div>
    </div>
  );
}
