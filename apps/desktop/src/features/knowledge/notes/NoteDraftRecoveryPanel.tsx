import { useState } from "react";
import { Button, ConfirmDialog } from "@research-copilot/ui";
import type { KnowledgeNote } from "@research-copilot/types";

export default function NoteDraftRecoveryPanel({
  persistenceError, saveError, conflictingNote, saving,
  onRetryPersistence, onSaveAsCopy, onDiscardDraft,
}: {
  persistenceError: string;
  saveError: string;
  conflictingNote: KnowledgeNote | null;
  saving: boolean;
  onRetryPersistence: () => void;
  onSaveAsCopy: () => Promise<void>;
  onDiscardDraft: () => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (!persistenceError && !saveError && !conflictingNote) return null;

  return (
    <div className="mx-5 mt-4 space-y-3 rounded-2xl px-4 py-3 text-sm" style={{
      background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)",
    }}>
      {persistenceError ? (
        <div role="alert" className="space-y-2">
          <p className="text-apple-red">{persistenceError}</p>
          <Button size="sm" variant="secondary" onClick={onRetryPersistence}>重试草稿操作</Button>
        </div>
      ) : null}
      {saveError ? <p role="alert" className="text-apple-red">{saveError}</p> : null}
      {conflictingNote ? (
        <div className="space-y-3">
          <p role="alert" className="text-ink-secondary">笔记已有其他修改，当前显示的是本机草稿。自动保存已暂停，请核对后另存或使用已保存版本。</p>
          <details className="text-ink-secondary">
            <summary className="cursor-pointer">查看已保存版本</summary>
            <p className="mt-3 font-medium">{conflictingNote.title}</p>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs">{conflictingNote.content}</pre>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={saving} disabled={saving} onClick={() => void onSaveAsCopy()}>将草稿另存为新笔记</Button>
            <Button size="sm" variant="secondary" disabled={saving} onClick={() => setConfirmDiscard(true)}>使用已保存版本</Button>
          </div>
          <ConfirmDialog
            open={confirmDiscard}
            title="放弃本机草稿？"
            description="将使用已保存的笔记版本，当前本机草稿中的修改会被移除。"
            confirmLabel="放弃草稿"
            tone="danger"
            onClose={() => setConfirmDiscard(false)}
            onConfirm={() => { onDiscardDraft(); setConfirmDiscard(false); }}
          />
        </div>
      ) : null}
    </div>
  );
}
