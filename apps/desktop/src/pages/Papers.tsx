import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import type { Paper, ResearchInterest } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, VenueTypeBadge, WosIndexBadge } from "../components/CcfBadges";
import CollapsibleGroup from "../components/CollapsibleGroup";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeletePaperId, setConfirmDeletePaperId] = useState<string | null>(null);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [visiblePaperTags, setVisiblePaperTags] = useState(() => parsePaperTagVisibility(DEFAULT_PAPER_TAG_VISIBILITY_VALUE));
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [editFolderPickerOpen, setEditFolderPickerOpen] = useState(false);
  const [autoRename, setAutoRename] = useState(true);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
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
    return interests.map((interest) => ({
      key: interest.id,
      title: interestFolderName(interest),
      subtitle: interest.topic,
      papers: papers.filter((paper) => paper.research_interest_id === interest.id),
    }));
  }, [interests, papers]);

  const ungroupedPapers = useMemo(() => (
    papers.filter((paper) => {
      if (!paper.research_interest_id) return true;
      return !(paper.research_interest_id in interestMap);
    })
  ), [interestMap, papers]);

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
      await Promise.all([
        apiClient.papers.analyze(id),
        apiClient.papers.reproduce(id),
      ]);
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

  const handleDeletePaper = async (id: string) => {
    try {
      setDeletingPaperId(id);
      setLoadError("");
      await apiClient.papers.delete(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
      setConfirmDeletePaperId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setDeletingPaperId(null);
    }
  };

  const handleDeleteInterestGroup = async (interestId: string, deleteAll: boolean) => {
    try {
      setDeletingGroupId(interestId);
      setLoadError("");
      if (deleteAll) {
        await apiClient.knowledge.deleteInterestBundle(interestId);
        setPapers((prev) => prev.filter((p) => p.research_interest_id !== interestId));
      } else {
        await apiClient.knowledge.deleteInterestOnly(interestId);
      }
      setInterests((prev) => prev.filter((item) => item.id !== interestId));
      setConfirmDeleteGroupId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setDeletingGroupId(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "analyzed") return <Badge variant="success">已分析</Badge>;
    if (status === "reproduced") return <Badge variant="success">已复现</Badge>;
    if (status === "failed" || status === "error") return <Badge variant="danger">失败</Badge>;
    if (status === "analyzing") return <Badge variant="info">分析中</Badge>;
    if (status === "parsed") return <Badge variant="info">已解析</Badge>;
    return <Badge variant="default">待分析</Badge>;
  };

  const statusIcon = (status: string) => {
    if (status === "analyzed" || status === "reproduced") {
      return <CheckCircle className="w-5 h-5 text-apple-green" />;
    }
    if (status === "failed" || status === "error") {
      return <AlertCircle className="w-5 h-5 text-apple-red" />;
    }
    if (status === "analyzing") {
      return (
        <div className="flex items-center gap-[3px]">
          {([0, 0.18, 0.36] as number[]).map((delay, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-apple-blue"
              style={{ animation: "thinking-dot 1.1s ease-in-out infinite", animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      );
    }
    return <FileText className="w-5 h-5 text-ink-tertiary" />;
  };

  const renderPaperCard = (paper: Paper) => (
    <Card key={paper.id} padding="sm" className="space-y-0" style={{ background: "rgba(255,255,255,0.82)" }}>
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl mt-0.5"
          style={{ background: "#F0F4F8", boxShadow: "inset 2px 2px 4px #C8CDD3, inset -2px -2px 4px #FFFFFF" }}
        >
          {statusIcon(paper.status)}
        </div>

        {/* 主信息 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ExternalLink
              href={paper.paper_url}
              className="text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
            >
              {paper.title}
            </ExternalLink>
            {statusBadge(paper.status)}
          </div>
          {/* 来源行 */}
          {(paper.venue || paper.ccf_area || paper.ccf_publisher || paper.journal_publisher) && (
            <p className="mt-0.5 text-xs leading-5 text-ink-secondary">
              {paper.venue ? (
                <ExternalLink
                  href={paper.venue_url}
                  className="text-xs text-ink-secondary hover:text-apple-blue hover:underline"
                >
                  {paper.venue}
                </ExternalLink>
              ) : "来源未知"}
              {paper.ccf_area ? ` · ${paper.ccf_area}` : ""}
              {paper.ccf_publisher ? ` · ${paper.ccf_publisher}` : ""}
              {!paper.ccf_publisher && paper.journal_publisher ? ` · ${paper.journal_publisher}` : ""}
            </p>
          )}
          {/* 评级标签行 */}
          {(visiblePaperTags.has("ccf_rating") || visiblePaperTags.has("ccf_type") || visiblePaperTags.has("wos_indexes") || visiblePaperTags.has("jcr_quartile") || visiblePaperTags.has("cas_quartile") || visiblePaperTags.has("cas_top")) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
          )}
          <p className="mt-1 text-[11px] text-ink-tertiary">
            {new Date(paper.created_at).toLocaleDateString("zh-CN")}
          </p>
        </div>

        {/* 操作区：图标工具 + 主要 CTA */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* 次要操作：图标按钮 */}
          <button
            type="button"
            onClick={() => {
              if (editingId === paper.id) {
                setEditingId(null);
              } else {
                openEditor(paper);
              }
            }}
            className={[
              "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
              editingId === paper.id ? "text-apple-blue" : "text-ink-tertiary hover:text-ink-primary",
            ].join(" ")}
            style={{
              background: "#EEF1F5",
              boxShadow: editingId === paper.id
                ? "inset 2px 2px 4px #C8CDD3, inset -2px -2px 4px #FFFFFF"
                : "2px 2px 4px #C8CDD3, -2px -2px 4px #FFFFFF",
            }}
            title={editingId === paper.id ? "收起编辑" : "编辑信息"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setConfirmDeletePaperId(confirmDeletePaperId === paper.id ? null : paper.id)}
            className={[
              "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
              confirmDeletePaperId === paper.id ? "text-apple-red" : "text-ink-tertiary/50 hover:text-apple-red",
            ].join(" ")}
            style={{
              background: "#EEF1F5",
              boxShadow: confirmDeletePaperId === paper.id
                ? "inset 2px 2px 4px #C8CDD3, inset -2px -2px 4px #FFFFFF"
                : "2px 2px 4px #C8CDD3, -2px -2px 4px #FFFFFF",
            }}
            title="删除论文"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* 主要 CTA */}
          <Button
            size="sm"
            onClick={() => void handleAnalyze(paper.id)}
            disabled={paper.status === "analyzing"}
          >
            {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {paper.status === "analyzing" ? "分析中…" : "小妍解读"}
          </Button>

          {/* 展开按钮 */}
          {(paper.analysis || paper.reproduction_guide) && (
            <button
              type="button"
              onClick={() => setExpanded(expanded === paper.id ? null : paper.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-tertiary hover:text-ink-primary transition-colors"
              style={{ background: "#EEF1F5", boxShadow: "2px 2px 4px #C8CDD3, -2px -2px 4px #FFFFFF" }}
            >
              {expanded === paper.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {confirmDeletePaperId === paper.id && (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(255,59,48,0.06)" }}
        >
          <span className="text-xs text-apple-red">确认删除这篇论文？此操作无法撤销。</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirmDeletePaperId(null)}>
              取消
            </Button>
            <button
              type="button"
              onClick={() => void handleDeletePaper(paper.id)}
              disabled={deletingPaperId === paper.id}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: "#FF3B30" }}
            >
              {deletingPaperId === paper.id && <Loader2 className="h-3 w-3 animate-spin" />}
              删除
            </button>
          </div>
        </div>
      )}

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
          <div
            className="relative space-y-1"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setEditFolderPickerOpen(false);
              }
            }}
          >
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">主题文件夹</label>
            <button
              type="button"
              onClick={() => setEditFolderPickerOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-sm text-ink-primary transition-all duration-150"
              style={{
                background: "#E8ECF0",
                boxShadow: editFolderPickerOpen
                  ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
                  : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
              }}
            >
              <span className="truncate">
                {editDraft.research_interest_id
                  ? interestFolderName(interests.find((i) => i.id === editDraft.research_interest_id)!)
                  : "未归档"}
              </span>
              <ChevronDown
                className="h-4 w-4 flex-shrink-0 text-ink-tertiary transition-transform duration-150"
                style={{ transform: editFolderPickerOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {editFolderPickerOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl py-1 overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #F2F6FA, #E8ECF0)",
                  boxShadow: "6px 6px 14px #C0C6CC, -4px -4px 10px #FFFFFF",
                }}
              >
                {[{ id: "", label: "未归档" }, ...interests.map((i) => ({
                  id: i.id,
                  label: interestFolderName(i),
                }))].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    tabIndex={0}
                    onClick={() => {
                      setEditDraft((prev) => ({ ...prev, research_interest_id: id }));
                      setEditFolderPickerOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors duration-100"
                    style={{
                      color: editDraft.research_interest_id === id ? "#007AFF" : "#1C1C1E",
                      background: editDraft.research_interest_id === id ? "rgba(0,122,255,0.08)" : "transparent",
                      fontWeight: editDraft.research_interest_id === id ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
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

      {expanded === paper.id && (paper.analysis || paper.reproduction_guide) && (
        <div className="mt-3 border-t border-nm-dark/10 pt-3 space-y-5">
          {paper.analysis && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-secondary tracking-wide">论文分析</p>
              {(
                [
                  ["研究问题", paper.analysis.research_question],
                  ["核心方法", paper.analysis.core_method],
                  ["实验设计", paper.analysis.experiment_design],
                  ["实验结果", paper.analysis.experiment_results],
                  ["创新点", paper.analysis.innovations],
                  ["局限性", paper.analysis.limitations],
                  ["关键结论", paper.analysis.key_conclusions],
                ] as [string, string | undefined][]
              )
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,0.025)" }}>
                    <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider">{label}</span>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-[1.7] text-ink-secondary">{value}</p>
                  </div>
                ))}
            </div>
          )}
          {paper.reproduction_guide && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-apple-blue tracking-wide">复现指南</p>
              {(
                [
                  ["代码仓库", paper.reproduction_guide.code_repository],
                  ["环境配置", paper.reproduction_guide.environment_setup],
                  ["依赖安装", paper.reproduction_guide.dependencies],
                  ["数据准备", paper.reproduction_guide.dataset_preparation],
                  ["训练流程", paper.reproduction_guide.training_process],
                  ["推理流程", paper.reproduction_guide.inference_process],
                  ["评估指标", paper.reproduction_guide.evaluation_metrics],
                  ["风险与注意事项", paper.reproduction_guide.risks_and_notes],
                ] as [string, string | undefined][]
              )
                .filter(([, value]) => value && value !== "暂无")
                .map(([label, value]) => (
                  <div key={label} className="rounded-xl px-3 py-2" style={{ background: "rgba(0,122,255,0.04)" }}>
                    <span className="text-[11px] font-semibold text-apple-blue/70 uppercase tracking-wider">{label}</span>
                    {label === "代码仓库" ? (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {value!.split("\n").filter(Boolean).map((url) => (
                          <ExternalLink
                            key={url}
                            href={url.trim()}
                            className="text-xs text-apple-blue hover:underline break-all"
                          >
                            {url.trim()}
                          </ExternalLink>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-[1.7] text-ink-secondary">{value}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <style>{`
        @keyframes thinking-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">论文库</h1>
          <p className="mt-0.5 text-sm text-ink-tertiary">
            {`共 ${papers.length} 篇论文 · ${interests.length} 个主题分组`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
          {/* 自动更名开关 */}
          <button
            type="button"
            onClick={() => setAutoRename((v) => !v)}
            className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-150 flex-shrink-0"
            style={{
              background: "#E8ECF0",
              boxShadow: autoRename
                ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
                : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
            }}
            title="导入后自动用提取的元数据重命名文件"
          >
            <span className={`text-xs font-medium transition-colors ${autoRename ? "text-apple-blue" : "text-ink-tertiary"}`}>
              自动更名
            </span>
            {/* pill track */}
            <div
              className="relative h-5 w-9 rounded-full transition-colors duration-200 flex-shrink-0"
              style={{ background: autoRename ? "#007AFF" : "#C8CDD3" }}
            >
              <div
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: autoRename ? "translateX(16px)" : "translateX(2px)" }}
              />
            </div>
          </button>

          <div
            className="relative min-w-[200px]"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setFolderPickerOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => setFolderPickerOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-sm text-ink-primary transition-all duration-150"
              style={{
                background: "#E8ECF0",
                boxShadow: folderPickerOpen
                  ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
                  : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
              }}
            >
              <span className="truncate">
                <span className="text-ink-tertiary">文件夹：</span>
                {selectedInterestId
                  ? interestFolderName(interests.find((i) => i.id === selectedInterestId)!)
                  : "未归档"}
              </span>
              <ChevronDown
                className="h-4 w-4 flex-shrink-0 text-ink-tertiary transition-transform duration-150"
                style={{ transform: folderPickerOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {folderPickerOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-20 rounded-2xl py-1 overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #F2F6FA, #E8ECF0)",
                  boxShadow: "6px 6px 14px #C0C6CC, -4px -4px 10px #FFFFFF",
                }}
              >
                {[{ id: "", label: "未归档" }, ...interests.map((i) => ({
                  id: i.id,
                  label: interestFolderName(i),
                }))].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedInterestId(id);
                      setFolderPickerOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors duration-100"
                    style={{
                      color: selectedInterestId === id ? "#007AFF" : "#1C1C1E",
                      background: selectedInterestId === id ? "rgba(0,122,255,0.08)" : "transparent",
                      fontWeight: selectedInterestId === id ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
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
            <p className="mt-1 text-sm text-ink-tertiary">上传 PDF，开始精读和分析。</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {paperGroups.map((group) => (
            <CollapsibleGroup
              key={group.key}
              title={group.title}
              subtitle={group.subtitle !== group.title ? `研究主题：${group.subtitle}` : undefined}
              countLabel={`${group.papers.length} 篇`}
              defaultOpen={group.papers.length > 0}
              bodyClassName="space-y-3"
              actions={
                confirmDeleteGroupId === group.key ? (
                  <>
                    <span className="text-xs text-ink-tertiary">删除文件夹：</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={deletingGroupId === group.key}
                      onClick={() => void handleDeleteInterestGroup(group.key, false)}
                    >
                      置为未归档
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={deletingGroupId === group.key}
                      onClick={() => void handleDeleteInterestGroup(group.key, true)}
                    >
                      删除全部
                    </Button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteGroupId(null)}
                      className="text-ink-tertiary hover:text-ink-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteGroupId(group.key)}
                    className="text-ink-tertiary/40 transition-colors hover:text-apple-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              }
            >
              {group.papers.length === 0 ? (
                <Card padding="sm" className="border border-dashed border-nm-dark/10 bg-white/25 py-8 text-center text-sm text-ink-tertiary">
                  这个方向下还没有论文，导入 PDF 后会显示在这里。
                </Card>
              ) : (
                group.papers.map(renderPaperCard)
              )}
            </CollapsibleGroup>
          ))}

          {ungroupedPapers.length > 0 && (
            <section className="space-y-3">
              <div className="px-1">
                <p className="text-sm font-semibold text-ink-primary">未归档论文</p>
                <p className="mt-1 text-xs text-ink-tertiary">这些论文暂未绑定主题，可直接编辑后移动到主题文件夹。</p>
              </div>
              {ungroupedPapers.map(renderPaperCard)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
