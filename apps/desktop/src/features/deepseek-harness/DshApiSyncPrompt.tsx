import { Button } from "@research-copilot/ui";

export default function DshApiSyncPrompt({ onConfirm, onCancel }: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="max-w-sm px-3 py-2 text-xs text-ink-secondary">
      同步当前主模型需要重启 DSH。
      <Button variant="ghost" size="sm" onClick={onConfirm}>同步并重启</Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>取消</Button>
    </div>
  );
}
