import { useEffect, useMemo, useState } from "react";
import { Network, Plus } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, Input, Select, Textarea } from "@research-copilot/ui";
import { interestDisplayName, type KnowledgeClaimStatus, type KnowledgeEvidenceRelationKind, type KnowledgeGraphSnapshot, type KnowledgeGraphSourceKind } from "./shared";

export default function KnowledgeGraphComposer({
  snapshot,
  activeInterestId,
  busy,
  onCreateClaim,
  onCreateEvidence,
  onCreateCitation,
}: {
  snapshot: KnowledgeGraphSnapshot;
  activeInterestId: string | null;
  busy?: boolean;
  onCreateClaim: (data: {
    title: string;
    statement: string;
    researchInterestId?: string;
    status?: KnowledgeClaimStatus;
  }) => Promise<boolean>;
  onCreateEvidence: (data: {
    claimId: string;
    sourceKind: KnowledgeGraphSourceKind;
    sourceId: string;
    relationKind?: KnowledgeEvidenceRelationKind;
    evidenceSummary?: string;
  }) => Promise<boolean>;
  onCreateCitation: (data: {
    citingPaperId: string;
    citedPaperId: string;
    context?: string;
  }) => Promise<boolean>;
}) {
  const [claimTitle, setClaimTitle] = useState("");
  const [claimStatement, setClaimStatement] = useState("");
  const [claimStatus, setClaimStatus] = useState<KnowledgeClaimStatus>("supported");
  const [evidenceClaimId, setEvidenceClaimId] = useState("");
  const [evidenceSourceKind, setEvidenceSourceKind] = useState<KnowledgeGraphSourceKind>("paper");
  const [evidenceSourceId, setEvidenceSourceId] = useState("");
  const [evidenceRelationKind, setEvidenceRelationKind] = useState<KnowledgeEvidenceRelationKind>("supports");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [citingPaperId, setCitingPaperId] = useState("");
  const [citedPaperId, setCitedPaperId] = useState("");
  const [citationContext, setCitationContext] = useState("");

  const claimOptions = useMemo(
    () =>
      [
        { value: "", label: "选择结论" },
        ...((activeInterestId
          ? snapshot.claims.filter((item) => item.researchInterestId === activeInterestId)
          : snapshot.claims
        ).map((item) => ({ value: item.id, label: item.title }))),
      ],
    [activeInterestId, snapshot.claims],
  );

  const paperOptions = useMemo(
    () =>
      [
        { value: "", label: "选择论文" },
        ...((activeInterestId
          ? snapshot.papers.filter((item) => item.researchInterestId === activeInterestId)
          : snapshot.papers
        ).map((item) => ({
          value: item.id,
          label: [item.year, item.title].filter(Boolean).join(" · "),
        }))),
      ],
    [activeInterestId, snapshot.papers],
  );

  const noteOptions = useMemo(
    () =>
      [
        { value: "", label: "选择笔记" },
        ...((activeInterestId
          ? snapshot.notes.filter((item) => item.researchInterestId === activeInterestId)
          : snapshot.notes
        ).map((item) => ({ value: item.id, label: item.title }))),
      ],
    [activeInterestId, snapshot.notes],
  );

  const experimentOptions = useMemo(
    () => [
      { value: "", label: "选择实验" },
      ...(snapshot.experiments.map((item) => ({ value: item.id, label: item.title }))),
    ],
    [snapshot.experiments],
  );

  const citationPaperOptions = useMemo(
    () => [
      { value: "", label: "选择论文" },
      ...(snapshot.papers.map((item) => ({
        value: item.id,
        label: [item.year, item.title].filter(Boolean).join(" · "),
      }))),
    ],
    [snapshot.papers],
  );

  const sourceOptions = evidenceSourceKind === "paper"
    ? paperOptions
    : evidenceSourceKind === "note"
      ? noteOptions
      : experimentOptions;

  useEffect(() => {
    if (claimOptions.some((item) => item.value === evidenceClaimId)) return;
    setEvidenceClaimId("");
  }, [claimOptions, evidenceClaimId]);

  useEffect(() => {
    if (sourceOptions.some((item) => item.value === evidenceSourceId)) return;
    setEvidenceSourceId("");
  }, [evidenceSourceId, sourceOptions]);

  const handleCreateClaim = async () => {
    const ok = await onCreateClaim({
      title: claimTitle,
      statement: claimStatement,
      researchInterestId: activeInterestId || undefined,
      status: claimStatus,
    });
    if (!ok) return;
    setClaimTitle("");
    setClaimStatement("");
    setClaimStatus("supported");
  };

  const handleCreateEvidence = async () => {
    const ok = await onCreateEvidence({
      claimId: evidenceClaimId,
      sourceKind: evidenceSourceKind,
      sourceId: evidenceSourceId,
      relationKind: evidenceRelationKind,
      evidenceSummary,
    });
    if (!ok) return;
    setEvidenceSourceId("");
    setEvidenceSummary("");
  };

  const handleCreateCitation = async () => {
    const ok = await onCreateCitation({
      citingPaperId,
      citedPaperId,
      context: citationContext,
    });
    if (!ok) return;
    setCitingPaperId("");
    setCitedPaperId("");
    setCitationContext("");
  };

  const activeInterest = activeInterestId
    ? snapshot.interests.find((item) => item.id === activeInterestId)
    : null;

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card padding="md">
        <CardHeader>
          <CardTitle>新增结论</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {activeInterest ? (
            <p className="knowledge-graph-context rounded-2xl px-3 py-2 text-xs text-ink-tertiary">
              当前会默认写入方向：{interestDisplayName(activeInterest)}
            </p>
          ) : null}
          <Input
            label="结论标题"
            placeholder="例如：多模态 RAG 的瓶颈在于检索证据对齐"
            value={claimTitle}
            onChange={(event) => setClaimTitle(event.target.value)}
          />
          <Textarea
            label="结论陈述"
            rows={5}
            placeholder="写清楚这条观点、边界和适用条件。"
            value={claimStatement}
            onChange={(event) => setClaimStatement(event.target.value)}
          />
          <Select
            label="状态"
            value={claimStatus}
            onChange={(value) => setClaimStatus(value as KnowledgeClaimStatus)}
            options={[
              { value: "hypothesis", label: "待验证" },
              { value: "supported", label: "已支持" },
              { value: "contested", label: "有争议" },
              { value: "open", label: "开放问题" },
            ]}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !claimTitle.trim() || !claimStatement.trim()}
            onClick={() => void handleCreateClaim()}
          >
            <Plus className="h-3.5 w-3.5" />
            写入图谱
          </Button>
        </div>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>绑定证据</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <Select
            label="挂到哪条结论"
            value={evidenceClaimId}
            onChange={setEvidenceClaimId}
            options={claimOptions}
          />
          <Select
            label="来源类型"
            value={evidenceSourceKind}
            onChange={(value) => {
              setEvidenceSourceKind(value as KnowledgeGraphSourceKind);
              setEvidenceSourceId("");
            }}
            options={[
              { value: "paper", label: "论文" },
              { value: "experiment", label: "实验" },
              { value: "note", label: "笔记" },
            ]}
          />
          <Select
            label="证据来源"
            value={evidenceSourceId}
            onChange={setEvidenceSourceId}
            options={sourceOptions}
          />
          <Select
            label="关系"
            value={evidenceRelationKind}
            onChange={(value) => setEvidenceRelationKind(value as KnowledgeEvidenceRelationKind)}
            options={[
              { value: "supports", label: "支持" },
              { value: "contradicts", label: "冲突" },
              { value: "background", label: "背景" },
            ]}
          />
          <Textarea
            label="证据说明"
            rows={4}
            placeholder="可选，写一句为什么这条来源能支撑该结论。"
            value={evidenceSummary}
            onChange={(event) => setEvidenceSummary(event.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !evidenceClaimId || !evidenceSourceId}
            onClick={() => void handleCreateEvidence()}
          >
            <Network className="h-3.5 w-3.5" />
            建立证据边
          </Button>
        </div>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>记录引用</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <Select
            label="引用方论文"
            value={citingPaperId}
            onChange={setCitingPaperId}
            options={citationPaperOptions}
          />
          <Select
            label="被引论文"
            value={citedPaperId}
            onChange={setCitedPaperId}
            options={citationPaperOptions}
          />
          <Textarea
            label="引用说明"
            rows={6}
            placeholder="可选，记录这条引用关系的重要性或阅读备注。"
            value={citationContext}
            onChange={(event) => setCitationContext(event.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !citingPaperId || !citedPaperId}
            onClick={() => void handleCreateCitation()}
          >
            <Network className="h-3.5 w-3.5" />
            写入引用边
          </Button>
        </div>
      </Card>
    </div>
  );
}
