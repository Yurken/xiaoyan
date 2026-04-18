import type { Dispatch, SetStateAction } from "react";
import { Bot, Download, History, Save, Sparkles, Upload } from "lucide-react";
import type { PaperVersion, Submission as SubmissionItem } from "./shared";
import { STATUS_CFG, computeLineDiff } from "./shared";

interface VersionWorkspaceProps {
  submissions: SubmissionItem[];
  versions: PaperVersion[];
  versionCounts: Record<string, number>;
  versionSubId: string;
  compareIds: [string, string] | null;
  onSelectSubmission: (submissionId: string) => void;
  onSetCompareIds: Dispatch<SetStateAction<[string, string] | null>>;
  onOpenSaveModal: () => void;
  onUploadVersionFile: (versionId: string) => void | Promise<void>;
  onDownloadVersionFile: (filePath?: string) => void | Promise<void>;
  onPolishVersion: (version: PaperVersion) => void;
  onOpenMockReview: (version: PaperVersion) => void | Promise<void>;
}

export default function VersionWorkspace({
  submissions,
  versions,
  versionCounts,
  versionSubId,
  compareIds,
  onSelectSubmission,
  onSetCompareIds,
  onOpenSaveModal,
  onUploadVersionFile,
  onDownloadVersionFile,
  onPolishVersion,
  onOpenMockReview,
}: VersionWorkspaceProps) {
  const subVersions = versions;
  const currentSub = submissions.find((submission) => submission.id === versionSubId);
  const versionMap = new Map(versions.map((version) => [version.id, version]));

  const selectForCompare = (versionId: string, slot: 0 | 1) => {
    onSetCompareIds((currentCompareIds) => {
      const fallbackVersionId = subVersions[0]?.id ?? versionId;
      const nextCompareIds = currentCompareIds ?? [fallbackVersionId, fallbackVersionId];
      const updatedCompareIds: [string, string] = [nextCompareIds[0], nextCompareIds[1]];
      updatedCompareIds[slot] = versionId;
      return updatedCompareIds;
    });
  };

  const comparedOldVersion = compareIds ? versionMap.get(compareIds[0]) : undefined;
  const comparedNewVersion = compareIds ? versionMap.get(compareIds[1]) : undefined;
  const diffResult =
    compareIds && compareIds[0] !== compareIds[1] && comparedOldVersion && comparedNewVersion
      ? computeLineDiff(comparedOldVersion.content, comparedNewVersion.content)
      : null;
  const diffStats = diffResult?.reduce(
    (stats, line) => {
      if (line.type === "add") {
        stats.added += 1;
      } else if (line.type === "remove") {
        stats.removed += 1;
      }
      return stats;
    },
    { added: 0, removed: 0 }
  );

  return (
    <div className="flex gap-5 h-full min-h-0">
      <div className="w-52 flex-shrink-0 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">投稿论文</p>
        {submissions.map((submission) => {
          const statusStyle = STATUS_CFG[submission.status];
          const active = submission.id === versionSubId;
          return (
            <button
              key={submission.id}
              onClick={() => onSelectSubmission(submission.id)}
              className="w-full text-left rounded-2xl p-3 transition-all duration-150"
              style={
                active
                  ? { background: "#007AFF", color: "#fff", boxShadow: "2px 4px 12px rgba(0,122,255,0.3)" }
                  : {
                      background: "var(--rc-card-bg)",
                      color: "var(--rc-text-primary)" as string,
                      boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                    }
              }
            >
              <p className="text-sm font-medium line-clamp-2 leading-snug">{submission.title}</p>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-[10px] truncate" style={{ opacity: 0.65 }}>
                  {submission.venue}
                </span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={
                    active
                      ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                      : { background: statusStyle.bg, color: statusStyle.color }
                  }
                >
                  {versionCounts[submission.id] ?? 0} 版本
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-ink-primary line-clamp-1">{currentSub?.title}</p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              共 {subVersions.length} 个版本
              {compareIds && compareIds[0] !== compareIds[1] && "  ·  已选择两个版本对比"}
            </p>
          </div>
          <button
            onClick={onOpenSaveModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 hover:opacity-80"
            style={{ background: "#007AFF", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
          >
            <Save className="w-3.5 h-3.5" />
            记录版本
          </button>
        </div>

        {subVersions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
            <History className="w-10 h-10 text-ink-tertiary" />
            <p className="text-sm text-ink-tertiary">暂无版本记录，点击「记录版本」保存论文稿件快照</p>
          </div>
        ) : (
          <>
            <div className="space-y-0">
              {[...subVersions].reverse().map((version, index, reversedVersions) => {
                const isLatest = index === 0;
                const stageStyle = STATUS_CFG[version.stage];
                const inCompare = compareIds?.includes(version.id) ?? false;

                return (
                  <div key={version.id} className="flex gap-3">
                    <div className="flex flex-col items-center w-8 flex-shrink-0">
                      <div
                        className="w-3 h-3 rounded-full border-2 mt-4 flex-shrink-0 z-10"
                        style={
                          isLatest
                            ? { background: "#007AFF", borderColor: "#007AFF" }
                            : { background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }
                        }
                      />
                      {index < reversedVersions.length - 1 ? (
                        <div className="w-px flex-1 mt-1" style={{ background: "var(--rc-border)" }} />
                      ) : null}
                    </div>

                    <div
                      className="flex-1 mb-3 rounded-2xl p-3.5 transition-all duration-150"
                      style={{
                        background: inCompare ? "rgba(0,122,255,0.06)" : "var(--rc-card-bg)",
                        boxShadow: inCompare
                          ? "0 0 0 1.5px #007AFF, 2px 2px 8px rgba(0,0,0,0.06)"
                          : "2px 2px 8px rgba(0,0,0,0.07), -1px -1px 4px rgba(255,255,255,0.65)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-ink-primary">{version.tag}</span>
                          <span className="text-sm text-ink-secondary">{version.label}</span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                            style={{ background: stageStyle.bg, color: stageStyle.color }}
                          >
                            {stageStyle.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-tertiary flex-shrink-0">
                          {version.createdAt.toLocaleDateString("zh-CN")}
                        </span>
                      </div>

                      {version.notes ? (
                        <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">{version.notes}</p>
                      ) : null}

                      <p className="mt-2 text-[11px] text-ink-tertiary line-clamp-2 leading-relaxed font-mono">
                        {version.content.slice(0, 120)}…
                      </p>

                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[10px] text-ink-tertiary">对比：</span>
                        {([0, 1] as const).map((slot) => (
                          <button
                            key={slot}
                            onClick={() => selectForCompare(version.id, slot)}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-lg transition-colors"
                            style={
                              compareIds?.[slot] === version.id
                                ? { background: "#007AFF", color: "#fff" }
                                : {
                                    background: "var(--rc-card-inset-bg)",
                                    color: "var(--rc-text-tertiary)" as string,
                                  }
                            }
                          >
                            {slot === 0 ? "旧" : "新"}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onUploadVersionFile(version.id)}
                          className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                          style={{
                            background: "var(--rc-card-inset-bg)",
                            color: "var(--rc-text-tertiary)" as string,
                          }}
                          title="上传论文 PDF"
                        >
                          <Upload className="w-3 h-3" />
                          上传
                        </button>

                        {version.filePath ? (
                          <button
                            onClick={() => onDownloadVersionFile(version.filePath)}
                            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                            style={{ background: "var(--rc-card-inset-bg)", color: "#007AFF" }}
                            title="下载论文 PDF"
                          >
                            <Download className="w-3 h-3" />
                            下载
                          </button>
                        ) : null}

                        {version.content.trim() ? (
                          <button
                            onClick={() => onPolishVersion(version)}
                            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all duration-150"
                            style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}
                            title="AI 润色摘要/核心内容"
                          >
                            <Sparkles className="w-3 h-3" />
                            AI 润色
                          </button>
                        ) : null}

                        <button
                          onClick={() => onOpenMockReview(version)}
                          className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all duration-150"
                          style={
                            version.filePath
                              ? { background: "rgba(175,82,222,0.12)", color: "#AF52DE" }
                              : {
                                  background: "var(--rc-card-inset-bg)",
                                  color: "var(--rc-text-tertiary)" as string,
                                }
                          }
                          title={version.filePath ? "从 PDF 文件生成 AI 审稿意见" : "从版本快照文本生成 AI 审稿意见"}
                        >
                          <Bot className="w-3 h-3" />
                          AI 审稿
                        </button>

                        {version.filePath ? (
                          <span className="text-[10px] text-ink-tertiary truncate flex-1">{version.fileName}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {diffResult && compareIds && diffStats ? (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--rc-border)" }}>
                <div
                  className="px-4 py-2.5 flex items-center gap-2"
                  style={{ background: "var(--rc-card-inset-bg)", borderBottom: "1px solid var(--rc-border)" }}
                >
                  <History className="w-4 h-4 text-ink-tertiary" />
                  <span className="text-sm font-semibold text-ink-primary">差异对比</span>
                  <span className="text-xs text-ink-tertiary">
                    {comparedOldVersion?.tag}
                    {" → "}
                    {comparedNewVersion?.tag}
                  </span>
                  <div className="ml-auto flex items-center gap-3 text-[11px]">
                    <span style={{ color: "#34C759" }}>+{diffStats.added} 行新增</span>
                    <span style={{ color: "#FF3B30" }}>-{diffStats.removed} 行删除</span>
                  </div>
                </div>
                <div className="p-1 overflow-x-auto max-h-72 overflow-y-auto">
                  {diffResult.map((line, index) => (
                    <div
                      key={`${line.type}-${index}`}
                      className="flex items-baseline gap-2 px-3 py-0.5 rounded-lg text-xs font-mono leading-relaxed"
                      style={
                        line.type === "add"
                          ? { background: "rgba(52,199,89,0.10)", color: "#1A7F37" }
                          : line.type === "remove"
                            ? { background: "rgba(255,59,48,0.10)", color: "#C0392B" }
                            : { color: "var(--rc-text-secondary)" as string }
                      }
                    >
                      <span className="select-none w-3 flex-shrink-0 text-[10px]">
                        {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
                      </span>
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
