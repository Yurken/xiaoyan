import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  FlaskConical,
  Loader2,
  Pencil,
  Upload,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import type { Paper, ResearchInterest } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, VenueTypeBadge, WosIndexBadge } from "../components/CcfBadges";
import ExternalLink from "../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../lib/client";
import { DEFAULT_PAPER_TAG_VISIBILITY_VALUE, parsePaperTagVisibility } from "../lib/paperTags";

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

export default function Papers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedRepro, setExpandedRepro] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [visiblePaperTags, setVisiblePaperTags] = useState(() => parsePaperTagVisibility(DEFAULT_PAPER_TAG_VISIBILITY_VALUE));
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [editDraft, setEditDraft] = useState({
    title: "",
    authors: "",
    venue: "",
    year: "",
    doi: "",
    research_interest_id: "",
  });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError("");

    apiClient.papers
      .list()
      .then((data) => {
        if (!cancelled) {
          setPapers(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setPapers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient.knowledge
      .listInterests()
      .then((data) => {
        if (!cancelled) {
          setInterests(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInterests([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient.settings
      .get()
      .then((settings) => {
        if (!cancelled) {
          setVisiblePaperTags(parsePaperTagVisibility(settings.paper_visible_venue_tags));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVisiblePaperTags(parsePaperTagVisibility(DEFAULT_PAPER_TAG_VISIBILITY_VALUE));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const interestMap = useMemo(
    () => Object.fromEntries(interests.map((item) => [item.id, item])),
    [interests]
  );

  const paperGroups = useMemo(() => {
    const grouped = interests.map((interest) => ({
      key: interest.id,
      title: interestFolderName(interest),
      subtitle: interest.topic,
      papers: papers.filter((paper) => paper.research_interest_id === interest.id),
    }));

    const ungrouped = papers.filter((paper) => {
      if (!paper.research_interest_id) return true;
      return !(paper.research_interest_id in interestMap);
    });

    return [
      ...grouped,
      {
        key: "__ungrouped__",
        title: "未归档",
        subtitle: "尚未关联研究方向",
        papers: ungrouped,
      },
    ];
  }, [interestMap, interests, papers]);

  const handleUpload = async () => {
    try {
      setLoadError("");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;

      const selectedPath =
        typeof selected === "string"
          ? selected
          : typeof selected === "object" && selected !== null && "path" in selected
            ? String((selected as { path: unknown }).path)
            : "";

      if (!selectedPath) {
        throw new Error("未识别的文件路径，请重新选择 PDF 文件");
      }

      setUploading(true);
      await apiClient.papers.upload(selectedPath, selectedInterestId || undefined);
      const updated = await apiClient.papers.list();
      setPapers(updated);
    } catch (error) {
      console.error(error);
      setLoadError(formatErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const unlisten = listen<{ paper_id: string; status: string }>("paper:status", (event) => {
      const { paper_id, status } = event.payload;
      setPapers((prev) => prev.map((paper) => (paper.id === paper_id ? { ...paper, status } : paper)));
    });

    return () => {
      void unlisten.then((cleanup) => cleanup());
    };
  }, []);

  const handleAnalyze = async (id: string) => {
    try {
      setLoadError("");
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, status: "analyzing" } : paper)));
      await apiClient.papers.analyze(id);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, status: "failed" } : paper)));
    }
  };

  const handleReproduce = async (id: string) => {
    try {
      setLoadError("");
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, status: "analyzing" } : paper)));
      await apiClient.papers.reproduce(id);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      setPapers((prev) => prev.map((paper) => (paper.id === id ? { ...paper, status: "failed" } : paper)));
    }
  };

  const openEditor = (paper: Paper) => {
    setEditingId(paper.id);
    setEditDraft({
      title: paper.title || "",
      authors: paper.authors || "",
      venue: paper.venue || "",
      year: paper.year ? String(paper.year) : "",
      doi: paper.doi || "",
      research_interest_id: paper.research_interest_id || "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const nextTitle = editDraft.title.trim();
      if (!nextTitle) {
        throw new Error("论文标题不能为空");
      }

      const yearText = editDraft.year.trim();
      const nextYear = yearText ? Number.parseInt(yearText, 10) : 0;
      if (yearText && Number.isNaN(nextYear)) {
        throw new Error("年份必须是合法数字");
      }

      setSavingEdit(true);
      setLoadError("");
      const updated = await apiClient.papers.update(id, {
        title: nextTitle,
        authors: editDraft.authors.trim(),
        venue: editDraft.venue.trim(),
        year: nextYear,
        doi: editDraft.doi.trim(),
        research_interest_id: editDraft.research_interest_id,
      });
      setPapers((prev) => prev.map((paper) => (paper.id === id ? updated : paper)));
      setEditingId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "analyzed") return <Badge variant="success">已分析</Badge>;
    if (status === "reproduced") return <Badge variant="success">已复现</Badge>;
    if (status === "failed" || status === "error") return <Badge variant="danger">失败</Badge>;
    if (status === "analyzing") return <Badge variant="info">分析中</Badge>;
    if (status === "parsed") return <Badge variant="info">已解析</Badge>;
    return <Badge variant="default">已上传</Badge>;
  };

  const statusIcon = (status: string) => {
    if (status === "analyzed" || status === "reproduced") {
      return <CheckCircle className="w-5 h-5 text-apple-green" />;
    }
    if (status === "failed" || status === "error") {
      return <AlertCircle className="w-5 h-5 text-apple-red" />;
    }
    if (status === "analyzing") {
      return <Loader2 className="w-5 h-5 animate-spin text-apple-blue" />;
    }
    return <FileText className="w-5 h-5 text-ink-tertiary" />;
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">论文库</h1>
          <p className="mt-0.5 text-sm text-ink-tertiary">
            {`共 ${papers.length} 篇论文 · ${interests.length} 个主题分组`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
          <div className="min-w-[220px]">
            <label className="mb-1 ml-1 block text-xs font-medium text-ink-tertiary">导入到主题文件夹</label>
            <select
              value={selectedInterestId}
              onChange={(event) => setSelectedInterestId(event.target.value)}
              className="w-full rounded-2xl border-0 px-4 py-2.5 text-sm text-ink-primary outline-none"
              style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
            >
              <option value="">未归档</option>
              {interests.map((interest) => (
                <option key={interest.id} value={interest.id}>
                  {interestFolderName(interest)}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={handleUpload} loading={uploading} size="md">
            <Upload className="w-4 h-4" />
            导入 PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "5px 5px 10px #C8CDD3, -5px -5px 10px #FFFFFF" }}
          >
            <Loader2 className="h-7 w-7 animate-spin text-apple-blue" />
          </div>
          <p className="text-sm text-ink-tertiary">加载中…</p>
        </div>
      ) : loadError ? (
        <Card className="flex flex-col items-center gap-4 py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <AlertCircle className="h-8 w-8 text-apple-red" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">无法连接后端</p>
            <p className="mt-1 break-all text-sm text-apple-red">{loadError}</p>
          </div>
        </Card>
      ) : papers.length === 0 && interests.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: "#E8ECF0", boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF" }}
          >
            <FileText className="h-8 w-8 text-ink-tertiary" />
          </div>
          <div>
            <p className="font-medium text-ink-secondary">还没有论文</p>
            <p className="mt-1 text-sm text-ink-tertiary">点击「导入 PDF」开始</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {paperGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{group.title}</p>
                <Badge variant="default">{`${group.papers.length} 篇`}</Badge>
                {group.subtitle !== group.title ? (
                  <span className="text-xs text-ink-tertiary">{`研究主题：${group.subtitle}`}</span>
                ) : null}
              </div>

              {group.papers.length === 0 ? (
                <Card padding="sm" className="border border-dashed border-nm-dark/10 bg-white/25 py-8 text-center text-sm text-ink-tertiary">
                  该主题下还没有论文。
                </Card>
              ) : (
                group.papers.map((paper) => (
                  <Card key={paper.id} padding="sm" className="space-y-0">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
                >
                  {statusIcon(paper.status)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ExternalLink
                      href={paper.paper_url}
                      className="truncate text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
                    >
                      {paper.title}
                    </ExternalLink>
                    {statusBadge(paper.status)}
                    {visiblePaperTags.has("ccf_rating") ? <CcfRatingBadge rating={paper.ccf_rating} /> : null}
                    {visiblePaperTags.has("ccf_type") ? <VenueTypeBadge type={paper.ccf_type} /> : null}
                    {visiblePaperTags.has("wos_indexes")
                      ? paper.wos_indexes?.map((index) => (
                          <WosIndexBadge key={`${paper.id}-${index}`} index={index} />
                        ))
                      : null}
                    {visiblePaperTags.has("jcr_quartile") ? <JcrQuartileBadge quartile={paper.jcr_quartile} /> : null}
                    {visiblePaperTags.has("cas_quartile") ? <CasQuartileBadge quartile={paper.cas_quartile} /> : null}
                    {visiblePaperTags.has("cas_top") ? <CasTopBadge top={paper.cas_top} /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-tertiary">
                    {new Date(paper.created_at).toLocaleDateString("zh-CN")}
                  </p>
                  {(paper.venue || paper.ccf_area || paper.ccf_publisher || paper.journal_publisher) && (
                    <p className="mt-1 text-xs leading-5 text-ink-secondary">
                      {paper.venue ? (
                        <ExternalLink
                          href={paper.venue_url}
                          className="text-xs text-ink-secondary hover:text-apple-blue hover:underline"
                        >
                          {paper.venue}
                        </ExternalLink>
                      ) : "未识别来源"}
                      {paper.ccf_area ? ` · ${paper.ccf_area}` : ""}
                      {paper.ccf_publisher ? ` · ${paper.ccf_publisher}` : ""}
                      {!paper.ccf_publisher && paper.journal_publisher ? ` · ${paper.journal_publisher}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEditor(paper)}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleAnalyze(paper.id)}
                    disabled={paper.status === "analyzing"}
                  >
                    {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {paper.status === "analyzing" ? "处理中…" : "AI 分析"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleReproduce(paper.id)}
                    disabled={paper.status === "analyzing"}
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    复现指南
                  </Button>
                  {paper.analysis && (
                    <button
                      onClick={() => setExpanded(expanded === paper.id ? null : paper.id)}
                      className="rounded-xl p-1.5 text-ink-tertiary transition-colors hover:text-ink-primary"
                      style={{ background: "#E8ECF0", boxShadow: "2px 2px 5px #C8CDD3, -2px -2px 5px #FFFFFF" }}
                    >
                      {expanded === paper.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                  {paper.reproduction_guide && (
                    <button
                      onClick={() => setExpandedRepro(expandedRepro === paper.id ? null : paper.id)}
                      className="rounded-xl p-1.5 text-ink-tertiary transition-colors hover:text-ink-primary"
                      style={{ background: "#E8ECF0", boxShadow: "2px 2px 5px #C8CDD3, -2px -2px 5px #FFFFFF" }}
                    >
                      <FlaskConical className={`h-4 w-4 ${expandedRepro === paper.id ? "text-apple-blue" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {editingId === paper.id && (
                <div className="mt-3 grid gap-3 border-t border-nm-dark/10 pt-3 md:grid-cols-2">
                  <Input
                    label="标题"
                    value={editDraft.title}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="论文标题"
                  />
                  <Input
                    label="作者"
                    value={editDraft.authors}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, authors: event.target.value }))}
                    placeholder="作者列表"
                  />
                  <Input
                    label="来源/会议/期刊"
                    value={editDraft.venue}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, venue: event.target.value }))}
                    placeholder="例如：CVPR / IEEE Transactions on Knowledge and Data Engineering"
                  />
                  <Input
                    label="年份"
                    value={editDraft.year}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, year: event.target.value }))}
                    placeholder="例如：2024"
                  />
                  <div className="space-y-1">
                    <label className="ml-1 block text-xs font-medium text-ink-tertiary">主题文件夹</label>
                    <select
                      value={editDraft.research_interest_id}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, research_interest_id: event.target.value }))}
                      className="w-full rounded-2xl border-0 px-4 py-2.5 text-sm text-ink-primary outline-none"
                      style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
                    >
                      <option value="">未归档</option>
                      {interests.map((interest) => (
                        <option key={interest.id} value={interest.id}>
                          {interestFolderName(interest)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      label="DOI"
                      value={editDraft.doi}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, doi: event.target.value }))}
                      placeholder="例如：10.1145/xxxx"
                    />
                  </div>
                  <div className="flex justify-end gap-2 md:col-span-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                      取消
                    </Button>
                    <Button size="sm" onClick={() => void handleSaveEdit(paper.id)} loading={savingEdit}>
                      保存
                    </Button>
                  </div>
                </div>
              )}

              {expanded === paper.id && paper.analysis && (
                <div className="mt-3 space-y-2 border-t border-nm-dark/10 pt-3">
                  {(
                    [
                      ["研究问题", paper.analysis.research_question],
                      ["核心方法", paper.analysis.core_method],
                      ["实验设计", paper.analysis.experiment_design],
                      ["创新点", paper.analysis.innovations],
                      ["局限性", paper.analysis.limitations],
                      ["关键结论", paper.analysis.key_conclusions],
                    ] as [string, string | undefined][]
                  )
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label}>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</span>
                        <p className="mt-0.5 text-xs leading-5 text-ink-secondary">{value}</p>
                      </div>
                    ))}
                </div>
              )}

              {expandedRepro === paper.id && paper.reproduction_guide && (
                <div className="mt-3 space-y-2 border-t border-nm-dark/10 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-apple-blue">复现指南</p>
                  {(
                    [
                      ["环境配置", paper.reproduction_guide.environment_setup],
                      ["依赖安装", paper.reproduction_guide.dependencies],
                      ["数据准备", paper.reproduction_guide.dataset_preparation],
                      ["训练流程", paper.reproduction_guide.training_process],
                      ["推理流程", paper.reproduction_guide.inference_process],
                      ["评估指标", paper.reproduction_guide.evaluation_metrics],
                      ["风险与注意事项", paper.reproduction_guide.risks_and_notes],
                    ] as [string, string | undefined][]
                  )
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label}>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</span>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-ink-secondary">{value}</p>
                      </div>
                    ))}
                </div>
              )}
                  </Card>
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
