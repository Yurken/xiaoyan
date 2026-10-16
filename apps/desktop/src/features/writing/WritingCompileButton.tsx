import { CheckCircle2, FileCheck2 } from "lucide-react";
import { Button } from "@research-copilot/ui";
import type { WritingCompileStatus, WritingExportTarget } from "./shared";
import { useWritingCompileFlash } from "./useWritingCompileFlash";

interface WritingCompileButtonProps {
  draftId: string;
  compileStatus: WritingCompileStatus;
  exportingTarget: WritingExportTarget | null;
  onCompile: () => void;
}

export default function WritingCompileButton({
  draftId, compileStatus, exportingTarget, onCompile,
}: WritingCompileButtonProps) {
  const flash = useWritingCompileFlash(draftId, compileStatus);

  return (
    <Button
      type="button"
      size="sm"
      variant="primary"
      onClick={onCompile}
      loading={compileStatus === "compiling"}
      disabled={exportingTarget !== null}
      className="shadow-sm transition-colors duration-500"
      style={flash ? { background: "#34C759", color: "#fff" } : undefined}
    >
      {compileStatus !== "compiling" && !flash && (
        <FileCheck2 className="h-3.5 w-3.5" />
      )}
      {flash ? (
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          编译完成
        </span>
      ) : (
        "编译 PDF"
      )}
    </Button>
  );
}
