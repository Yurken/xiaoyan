import { RefreshCw } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { useFieldDynamics } from "./useFieldDynamics";
import { FieldDynamicsFilters } from "./FieldDynamicsFilters";
import { FieldDynamicsPanel } from "./FieldDynamicsPanel";

export function FieldDynamicsWorkspace() {
  const {
    briefings,
    unreadCount,
    loading,
    scanning,
    interestId,
    setInterestId,
    importingPaper,
    importErrors,
    notice,
    setNotice,
    error,
    interests,
    scan,
    markRead,
    importPaper,
  } = useFieldDynamics();

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink-primary">研究领域动态</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            基于你关注的研究兴趣，自动生成的周期性领域简报
            {unreadCount > 0 ? ` · ${unreadCount} 份未读` : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FieldDynamicsFilters
            interests={interests}
            interestId={interestId}
            onInterestChange={setInterestId}
          />
          <Button
            variant="primary"
            size="md"
            loading={scanning}
            onClick={() => void scan()}
            className="inline-flex items-center gap-2"
          >
            {!scanning ? <RefreshCw className="h-4 w-4" /> : null}
            {scanning ? "生成中…" : "立即刷新"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {notice ? (
          <div className="mb-4 rounded-2xl border border-apple-green/20 bg-apple-green/10 px-4 py-3 text-sm font-medium text-apple-green">
            <div className="flex items-center justify-between gap-3">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                className="text-xs font-semibold opacity-70 transition-opacity hover:opacity-100"
              >
                收起
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-apple-red/20 bg-apple-red/10 px-4 py-3 text-sm text-apple-red">
            {error}
          </div>
        ) : null}

        <FieldDynamicsPanel
          briefings={briefings}
          loading={loading}
          importingPaper={importingPaper}
          importErrors={importErrors}
          onImportPaper={(briefingId, externalId, source, title) =>
            void importPaper(briefingId, externalId, source, title)
          }
          onMarkRead={(id) => void markRead(id)}
        />
      </div>
    </div>
  );
}
