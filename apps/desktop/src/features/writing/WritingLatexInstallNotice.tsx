import { Download, ExternalLink, Terminal } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { MACOS_TEXBIN_PATH } from "./shared";

interface WritingLatexInstallNoticeProps {
  openingInstaller: boolean;
  onDownloadInstaller: () => void;
  onOpenDownloadPage: () => void;
}

export default function WritingLatexInstallNotice({
  openingInstaller,
  onDownloadInstaller,
  onOpenDownloadPage,
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
            请安装 MacTeX / TeX Live，并确保 latexmk 或 xelatex 可用。macOS 常见路径：
            <span className="rc-selectable font-mono">{MACOS_TEXBIN_PATH}</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onDownloadInstaller}
          loading={openingInstaller}
        >
          <Download className="h-3.5 w-3.5" />
          下载 MacTeX
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onOpenDownloadPage}>
          <ExternalLink className="h-3.5 w-3.5" />
          安装说明
        </Button>
      </div>
    </div>
  );
}
