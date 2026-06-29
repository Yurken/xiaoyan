import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { ExperimentRecord } from "@research-copilot/types";
import { Button, Card } from "@research-copilot/ui";
import { experimentApi, formatErrorMessage } from "../../lib/client";

interface ExperimentRecordPanelProps {
  experiment: ExperimentRecord;
  onUpdate?: (experiment: ExperimentRecord) => void;
  onError?: (message: string) => void;
}

export function ExperimentRecordPanel({ experiment, onUpdate, onError }: ExperimentRecordPanelProps) {
  const [title, setTitle] = useState(experiment.title);
  const [result, setResult] = useState(experiment.result);
  const [notes, setNotes] = useState(experiment.notes);
  const [configText, setConfigText] = useState(() => JSON.stringify(experiment.config, null, 2));
  const [saving, setSaving] = useState(false);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    setTitle(experiment.title);
    setResult(experiment.result);
    setNotes(experiment.notes);
    setConfigText(JSON.stringify(experiment.config, null, 2));
    setConfigError("");
  }, [experiment]);

  const handleSave = useCallback(async () => {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText) as Record<string, unknown>;
    } catch {
      setConfigError("配置 JSON 格式无效");
      return;
    }
    setConfigError("");
    setSaving(true);
    try {
      await experimentApi.update(experiment.id, { title, result, notes, config });
      const updated: ExperimentRecord = { ...experiment, title, result, notes, config };
      onUpdate?.(updated);
    } catch (err) {
      onError?.(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [experiment, title, result, notes, configText, onUpdate, onError]);

  const dirty =
    title !== experiment.title ||
    result !== experiment.result ||
    notes !== experiment.notes ||
    configText !== JSON.stringify(experiment.config, null, 2);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-primary">实验记录</p>
          <p className="text-xs text-ink-tertiary mt-0.5">编辑当前实验的基本信息、结果与配置。</p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving} variant="secondary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存
        </Button>
      </div>

      <Card variant="inset" padding="md" className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="exp-title" className="text-xs font-medium text-ink-secondary">
            标题
          </label>
          <input
            id="exp-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm bg-white/5 border border-black/5 outline-none focus:border-apple-blue transition-colors"
            placeholder="实验标题"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="exp-result" className="text-xs font-medium text-ink-secondary">
            结果
          </label>
          <textarea
            id="exp-result"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={6}
            className="w-full rounded-xl px-3 py-2 text-sm bg-white/5 border border-black/5 outline-none focus:border-apple-blue transition-colors resize-none"
            placeholder="记录实验结果"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="exp-notes" className="text-xs font-medium text-ink-secondary">
            备注
          </label>
          <textarea
            id="exp-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-xl px-3 py-2 text-sm bg-white/5 border border-black/5 outline-none focus:border-apple-blue transition-colors resize-none"
            placeholder="补充说明、心得或待办事项"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="exp-config" className="text-xs font-medium text-ink-secondary">
            配置（JSON）
          </label>
          <textarea
            id="exp-config"
            value={configText}
            onChange={(e) => {
              setConfigText(e.target.value);
              setConfigError("");
            }}
            rows={10}
            spellCheck={false}
            className="w-full rounded-xl px-3 py-2 text-sm font-mono bg-white/5 border border-black/5 outline-none focus:border-apple-blue transition-colors resize-none"
            placeholder='{"key": "value"}'
          />
          {configError && <p className="text-xs text-apple-red">{configError}</p>}
        </div>
      </Card>
    </div>
  );
}
