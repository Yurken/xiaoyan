import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button, Card, Input, Select, Textarea } from "@research-copilot/ui";
import type { ExperimentRecord } from "@research-copilot/types";
import { experimentApi, submissionApi, formatErrorMessage } from "../../lib/client";
import { ExperimentAttachmentPanel } from "./ExperimentAttachmentPanel";

interface SubmissionItem {
  id: string;
  title: string;
}

interface ExperimentRecordPanelProps {
  experiment: ExperimentRecord;
  onUpdate?: (experiment: ExperimentRecord) => void;
  onError?: (message: string) => void;
}

export function ExperimentRecordPanel({ experiment, onUpdate, onError }: ExperimentRecordPanelProps) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [editTitle, setEditTitle] = useState(experiment.title);
  const [editConfig, setEditConfig] = useState("{}");
  const [editResult, setEditResult] = useState(experiment.result);
  const [editNotes, setEditNotes] = useState(experiment.notes);
  const [editLinked, setEditLinked] = useState(experiment.linkedSubmissionId ?? "");
  const [configError, setConfigError] = useState("");
  const [saving, setSaving] = useState(false);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditTitle(experiment.title);
    setEditConfig(JSON.stringify(experiment.config, null, 2));
    setEditResult(experiment.result);
    setEditNotes(experiment.notes);
    setEditLinked(experiment.linkedSubmissionId ?? "");
    setConfigError("");
  }, [experiment]);

  useEffect(() => {
    submissionApi
      .list()
      .then((result) => {
        const list = ((result as { submissions?: unknown[] }).submissions ?? []) as Record<string, unknown>[];
        setSubmissions(list.map((s) => ({ id: String(s.id ?? ""), title: String(s.title ?? "") })));
      })
      .catch(() => setSubmissions([]));
  }, []);

  const handleSave = useCallback(async () => {
    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = JSON.parse(editConfig);
      setConfigError("");
    } catch {
      setConfigError("JSON 格式错误，请检查配置内容");
      return;
    }

    setSaving(true);
    try {
      await experimentApi.update(experiment.id, {
        title: editTitle,
        config: parsedConfig,
        result: editResult,
        notes: editNotes,
        linkedSubmissionId: editLinked || undefined,
      });
      const updated: ExperimentRecord = {
        ...experiment,
        title: editTitle,
        config: parsedConfig,
        result: editResult,
        notes: editNotes,
        linkedSubmissionId: editLinked || null,
        updatedAt: new Date().toISOString(),
      };
      onUpdate?.(updated);
    } catch (err) {
      onError?.(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [experiment, editTitle, editConfig, editResult, editNotes, editLinked, onUpdate, onError]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存
        </Button>
      </div>

      {/* Title */}
      <Input
        label="标题"
        ref={titleInputRef}
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        placeholder="实验名称"
      />

      {/* Linked submission */}
      <Select
        label="关联投稿（可选）"
        value={editLinked}
        onChange={setEditLinked}
        options={[
          { value: "", label: "— 不关联 —" },
          ...submissions.map((submission) => ({ value: submission.id, label: submission.title })),
        ]}
      />

      {/* Config JSON */}
      <Card variant="inset" padding="sm" className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-ink-primary">实验配置</p>
          <p className="text-[10px] text-ink-tertiary">JSON 格式，保存超参数、路径等信息</p>
        </div>
        <Textarea
          value={editConfig}
          onChange={(e) => { setEditConfig(e.target.value); setConfigError(""); }}
          rows={7}
          error={configError}
          placeholder={'{\n  "lr": 0.001,\n  "epochs": 100,\n  "batch_size": 32\n}'}
          style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: "12px" }}
        />
      </Card>

      {/* Result */}
      <Card variant="inset" padding="sm" className="space-y-2">
        <p className="text-xs font-semibold text-ink-primary">实验结果</p>
        <Textarea
          value={editResult}
          onChange={(e) => setEditResult(e.target.value)}
          rows={5}
          placeholder="记录实验指标、对比分析、图表说明…"
        />
      </Card>

      {/* Screenshots */}
      <Card variant="inset" padding="sm">
        <ExperimentAttachmentPanel experimentId={experiment.id} onError={onError ?? (() => {})} />
      </Card>

      {/* Notes */}
      <Card variant="inset" padding="sm" className="space-y-2">
        <p className="text-xs font-semibold text-ink-primary">备注与分析</p>
        <Textarea
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          rows={4}
          placeholder="分析实验现象、后续改进计划、与其他实验的对比…"
        />
      </Card>
    </div>
  );
}
