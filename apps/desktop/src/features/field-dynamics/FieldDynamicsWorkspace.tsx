import { Archive, CheckCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@research-copilot/ui";
import { useFieldDynamics } from "./useFieldDynamics";
import { FieldDynamicsFilters } from "./FieldDynamicsFilters";
import { FieldDynamicsPanel } from "./FieldDynamicsPanel";
import { FieldDynamicsHistoryPanel } from "./FieldDynamicsHistoryPanel";
import { FieldDynamicsInsightsPanel } from "./FieldDynamicsInsightsPanel";

export function FieldDynamicsWorkspace() {
  const [showHistory, setShowHistory] = useState(false);
  const {
    briefings,
    history,
    unreadCount,
    loading,
    historyLoading,
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
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowHistory((visible) => !visible)}
            className="inline-flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            {showHistory ? "当前简报" : "历史简报"}
          </Button>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => void markRead()}
              className="inline-flex items-center gap-1.5"
            >
              <CheckCheck className="h-4 w-4" /> 全部已读
            </Button>
          ) : null}
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

        {showHistory ? (
          <FieldDynamicsHistoryPanel
            briefings={history}
            importingPaper={importingPaper}
            importErrors={importErrors}
            onImportPaper={(briefingId, externalId, source, title) =>
              void importPaper(briefingId, externalId, source, title)
            }
          />
        ) : (
          <>
            <FieldDynamicsInsightsPanel
              briefings={briefings}
              history={history}
              loading={historyLoading}
            />
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
          </>
        )}
      </div>
    </div>
  );
}
