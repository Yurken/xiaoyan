import { useState, useMemo } from "react";
import {
  AlertCircle,
  Eye,
  FileText,
  FlaskConical,
  Loader2,
  Pencil,
  Quote,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@research-copilot/ui";
import type { Paper, ResearchInterest } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, VenueTypeBadge, WosIndexBadge } from "../../components/CcfBadges";
import CollapsibleGroup from "../../components/CollapsibleGroup";
import PaperCitationPanel from "./PaperCitationPanel";
import PaperTaskProgressPanel from "./PaperTaskProgressPanel";
import { usePaperTaskProgress } from "./usePaperTaskProgress";
import type { PaperFigure } from "./shared";

type SortKey = "created_at" | "title" | "importance";

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

interface PapersListPanelProps {
  papers: Paper[];
  interests: ResearchInterest[];
  loading: boolean;
  uploading: boolean;
  batchProgress: { done: number; total: number } | null;
  loadError: string;
  deletingPaperId: string | null;
  savingEdit: boolean;
  selectedInterestId: string;
  deletingGroupId: string | null;
  paperGroups: { key: string; title: string; subtitle: string; papers: Paper[] }[];
  ungroupedPapers: Paper[];
  detailPaperId: string | null;
  paperFigures: Record<string, PaperFigure[]>;
  taskProgressByPaperId: Record<string, unknown>;
  sortKeys: Record<string, SortKey>;
  keywordFilters: Record<string, string>;
  titleFilters: Record<string, string>;
  onUpload: () => void;
  onAnalyze: (id: string) => void;
  onReproduce: (id: string) => void;
  onUpdatePaper: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  onDeletePaper: (id: string) => void;
  onDeleteInterestGroup: (id: string, deleteAll: boolean) => void;
  onSelectInterest: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onCloseDetail: () => void;
  onSetDetailPaperId: (id: string | null) => void;
  onSortKeyChange: (groupId: string, key: SortKey) => void;
  onKeywordFilterChange: (groupId: string, kw: string) => void;
  onTitleFilterChange: (groupId: string, q: string) => void;
  getSortKey: (groupId: string) => SortKey;
  hideFolders?: boolean;
}

export function PapersListPanel(props: PapersListPanelProps) {
  const {
    papers, interests, loading, uploading, batchProgress, loadError,
    deletingPaperId, savingEdit, selectedInterestId, deletingGroupId,
    paperGroups, ungroupedPapers, detailPaperId, paperFigures, taskProgressByPaperId,
    sortKeys, keywordFilters, titleFilters,
    onUpload, onAnalyze, onReproduce, onUpdatePaper, onDeletePaper,
    onDeleteInterestGroup, onSelectInterest, onOpenDetail, onCloseDetail, onSetDetailPaperId,
    onSortKeyChange, onKeywordFilterChange, onTitleFilterChange, getSortKey,
    hideFolders,
  } = props;

  const [confirmDeletePaperId, setConfirmDeletePaperId] = useState<string | null>(null);
  const [confirmReanalyzePaperId, setConfirmReanalyzePaperId] = useState<string | null>(null);
  const [citationPaperId, setCitationPaperId] = useState<string | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: "", authors: "", venue: "", year: "", doi: "",
    research_interest_id: "", importance_color: "", notes: "",
  });

  const SORT_LABELS: Record<SortKey, string> = { created_at: "导入时间", title: "名称", importance: "重要性" };
  const COLOR_PRIORITY = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE"];
  const hasLoadedContent = papers.length > 0 || interests.length > 0;

  const statusBadge = (status: string) => {
    if (status === "analyzed" || status === "reproduced") return <Badge variant="success">已解读</Badge>;
    if (status === "failed" || status === "error") return <Badge variant="danger">失败</Badge>;
    if (status === "analyzing") return <Badge variant="info">分析中</Badge>;
    if (status === "parsing") return <Badge variant="info">解析中</Badge>;
    if (status === "parsed") return <Badge variant="info">已解析</Badge>;
    return <Badge variant="default">待分析</Badge>;
  };

  const canStartAnalyze = (status: string) => !["analyzing", "parsing", "uploaded"].includes(status);
  const requiresReanalyzeConfirm = (p: Paper) => p.status === "analyzed" || p.status === "reproduced";

  const inputStyle = (active: boolean) => ({
    background: active ? "rgba(0,122,255,0.1)" : "var(--rc-surface)",
    color: active ? "#007AFF" : "#8E8E93",
    fontWeight: active ? 600 : 400,
    boxShadow: active ? "inset 1px 1px 2px rgba(0,122,255,0.15)" : "var(--rc-chip-shadow)",
  });

  const openEditor = (paper: Paper) => {
    setEditingId(paper.id);
    setEditDraft({
      title: paper.title || "", authors: paper.authors || "",
      venue: paper.venue || "", year: paper.year ? String(paper.year) : "",
      doi: paper.doi || "", research_interest_id: paper.research_interest_id || "",
      importance_color: paper.importance_color || "", notes: paper.notes || "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    const nextTitle = editDraft.title.trim();
    if (!nextTitle) throw new Error("论文标题不能为空");
    const yearText = editDraft.year.trim();
    if (yearText && !/^\d{4}$/.test(yearText)) throw new Error("年份需填写 4 位数字");
    await onUpdatePaper(id, {
      title: nextTitle, authors: editDraft.authors.trim(),
      venue: editDraft.venue.trim(), year: yearText ? Number.parseInt(yearText, 10) : 0,
      doi: editDraft.doi.trim(), research_interest_id: editDraft.research_interest_id,
      importance_color: editDraft.importance_color, notes: editDraft.notes,
    });
    setEditingId(null);
  };

  const editTitleError = editingId && !editDraft.title.trim() ? "标题不能为空" : "";
  const editYearText = editDraft.year.trim();
  const editYearError = editingId && editYearText && !/^\d{4}$/.test(editYearText) ? "年份需填写 4 位数字" : "";

  const renderSortControl = (groupId: string) => (
    <div className="flex items-center gap-1">
      {(["created_at", "title", "importance"] as SortKey[]).map((key) => {
        const active = getSortKey(groupId) === key;
        return (
          <button key={key} type="button" onClick={(e) => { e.stopPropagation(); onSortKeyChange(groupId, key); }}
            className="rounded-lg px-2 py-0.5 text-[10px] transition-all"
            style={{ background: active ? "#007AFF" : "var(--rc-surface)", color: active ? "#fff" : "#999",
              boxShadow: active ? "inset 1px 1px 2px rgba(0,0,0,0.2)" : "var(--rc-chip-shadow)", fontWeight: active ? 600 : 400 }}>
            {SORT_LABELS[key]}
          </button>
        );
      })}
    </div>
  );

  const renderGroupControls = (groupId: string) => {
    const activeKw = keywordFilters[groupId] ?? "";
    const activeTf = titleFilters[groupId] ?? "";
    return (
      <div className="flex items-center gap-2">
        <input type="text" value={activeTf} placeholder="搜索标题" onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onTitleFilterChange(groupId, e.target.value); }}
          className="rounded-lg px-2 py-0.5 text-[10px] outline-none border-none w-20" style={inputStyle(!!activeTf)} />
        <input type="text" value={activeKw} placeholder="标签过滤" onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onKeywordFilterChange(groupId, e.target.value); }}
          className="rounded-lg px-2 py-0.5 text-[10px] outline-none border-none w-20" style={inputStyle(!!activeKw)} />
        {renderSortControl(groupId)}
      </div>
    );
  };

  const renderPaperCard = (paper: Paper, groupId: string) => (
    <Card key={paper.id} padding="sm" className="relative">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-semibold text-ink-primary">{paper.title}</span>
            {statusBadge(paper.status)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-tertiary">
            {paper.authors && <span>{paper.authors}</span>}
            {paper.year && <span>{paper.year}</span>}
            {paper.venue && <span className="text-apple-blue font-medium">{paper.venue}</span>}
            {paper.venue_type && <VenueTypeBadge kind={paper.venue_type} />}
            {paper.wos_index && paper.wos_index !== "none" && <WosIndexBadge level={paper.wos_index} />}
            {paper.jcr_quartile && paper.jcr_quartile !== "N/A" && <JcrQuartileBadge quartile={paper.jcr_quartile} />}
            {paper.cas_quartile && paper.cas_quartile !== "N/A" && <CasQuartileBadge quartile={paper.cas_quartile} />}
            {paper.cas_top && <CasTopBadge />}
            {paper.ccf_rating && <CcfRatingBadge level={paper.ccf_rating} />}
            {paper.importance_color && (
              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: paper.importance_color }}
                title={COLOR_PRIORITY.indexOf(paper.importance_color) >= 0 ? ["极其重要","非常重要","重要","较重要","一般","不重要"][COLOR_PRIORITY.indexOf(paper.importance_color)] : ""} />
            )}
          </div>
          {paper.tags && paper.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {paper.tags.map((tag) => (
                <span key={tag} className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary"
                  style={{ background: "var(--rc-chip-inset-bg)" }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-nm-dark/10 pt-2">
        <Button size="sm" variant="secondary" onClick={() => openEditor(paper)}><Pencil className="h-3.5 w-3.5" />编辑</Button>
        <Button size="sm" variant="secondary" onClick={() => setConfirmDeletePaperId(confirmDeletePaperId === paper.id ? null : paper.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setCitationPaperId(citationPaperId === paper.id ? null : paper.id)}>
          <Quote className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => {
          if (requiresReanalyzeConfirm(paper)) { setConfirmReanalyzePaperId((prev) => (prev === paper.id ? null : paper.id)); return; }
          onAnalyze(paper.id);
        }} disabled={!canStartAnalyze(paper.status)}>
          {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {paper.status === "analyzing" ? "分析中…" : paper.status === "parsing" ? "解析中…" : "小妍解读"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onReproduce(paper.id)} disabled={!canStartAnalyze(paper.status)} title="生成复现/验证指南">
          <FlaskConical className="h-3.5 w-3.5" />复现
        </Button>
        {(paper.analysis || paper.reproduction_guide || ["parsed","failed","error"].includes(paper.status)) && (
          <button type="button" onClick={() => detailPaperId === paper.id ? onCloseDetail() : onOpenDetail(paper.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ background: "var(--rc-surface)", boxShadow: detailPaperId === paper.id ? "var(--rc-inset-shadow)" : "var(--rc-chip-shadow)", color: detailPaperId === paper.id ? "#007AFF" : "var(--rc-text-secondary)" }}
            title={detailPaperId === paper.id ? "关闭详情" : "查看详情"}>
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>

      {paper.status === "analyzing" && taskProgressByPaperId[paper.id] ? (
        <PaperTaskProgressPanel progress={taskProgressByPaperId[paper.id]} />
      ) : null}

      {confirmDeletePaperId === paper.id && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,59,48,0.06)" }}>
          <span className="text-xs text-apple-red">确认删除这篇论文？</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirmDeletePaperId(null)}>取消</Button>
            <button type="button" onClick={() => { onDeletePaper(paper.id); setConfirmDeletePaperId(null); }}
              disabled={deletingPaperId === paper.id}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: "#FF3B30" }}>
              {deletingPaperId === paper.id && <Loader2 className="h-3 w-3 animate-spin" />}删除
            </button>
          </div>
        </div>
      )}

      {confirmReanalyzePaperId === paper.id && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,122,255,0.08)" }}>
          <span className="text-xs text-[#0A62D0]">已有解读结果，确认重新解读？</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setConfirmReanalyzePaperId(null)}>取消</Button>
            <button type="button" onClick={() => { onAnalyze(paper.id); setConfirmReanalyzePaperId(null); }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors"
              style={{ background: "#007AFF" }}>确认重新解读</button>
          </div>
        </div>
      )}

      {citationPaperId === paper.id && <PaperCitationPanel paper={paper} onClose={() => setCitationPaperId(null)} />}

      {editingId === paper.id && (
        <div className="mt-3 grid gap-3 border-t border-nm-dark/10 pt-3 md:grid-cols-2">
          <Input label="标题" value={editDraft.title} error={editTitleError}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="论文标题" />
          <Input label="作者" value={editDraft.authors}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, authors: e.target.value }))} placeholder="作者列表" />
          <Input label="来源" value={editDraft.venue}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, venue: e.target.value }))} placeholder="会议/期刊" />
          <Input label="年份" value={editDraft.year} error={editYearError}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, year: e.target.value }))} placeholder="2024" />
          <Select label="研究主题" value={editDraft.research_interest_id}
            onChange={(value) => setEditDraft((prev) => ({ ...prev, research_interest_id: value }))}
            options={[{ value: "", label: "未归档" }, ...interests.map((i) => ({ value: i.id, label: interestFolderName(i) }))]} />
          <Input label="DOI" value={editDraft.doi}
            onChange={(e) => setEditDraft((prev) => ({ ...prev, doi: e.target.value }))} placeholder="10.1145/xxxx" />
          <div className="md:col-span-2 space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">重要性标记</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[{ color: "", label: "无" }, { color: "#FF3B30", label: "极其重要" }, { color: "#FF9500", label: "非常重要" },
                { color: "#FFCC00", label: "重要" }, { color: "#34C759", label: "较重要" },
                { color: "#007AFF", label: "一般" }, { color: "#AF52DE", label: "不重要" }].map(({ color, label }) => (
                <button key={label} type="button" onClick={() => setEditDraft((prev) => ({ ...prev, importance_color: color }))}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs transition-all"
                  style={{ background: editDraft.importance_color === color ? (color || "rgba(0,0,0,0.08)") : "var(--rc-surface)",
                    color: editDraft.importance_color === color && color ? "#fff" : "#666",
                    boxShadow: editDraft.importance_color === color ? "inset 1px 1px 3px rgba(0,0,0,0.2)" : "var(--rc-chip-shadow)",
                    fontWeight: editDraft.importance_color === color ? 600 : 400 }}>
                  {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}{label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">备注</label>
            <textarea value={editDraft.notes} onChange={(e) => setEditDraft((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="添加备注" rows={2}
              className="w-full resize-none rounded-2xl px-4 py-2.5 text-sm text-ink-primary outline-none"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }} />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>取消</Button>
            <Button size="sm" onClick={() => void handleSaveEdit(paper.id)} loading={savingEdit} disabled={Boolean(editTitleError || editYearError)}>保存</Button>
          </div>
        </div>
      )}

      {paper.notes && editingId !== paper.id && (
        <p className="mt-2 border-t border-black/5 pt-2 text-[11px] leading-relaxed text-ink-tertiary/80">{paper.notes}</p>
      )}
    </Card>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <Loader2 className="h-7 w-7 animate-spin text-apple-blue" />
        </div>
        <p className="text-sm text-ink-tertiary">加载中…</p>
      </div>
    );
  }

  if (loadError && !hasLoadedContent) {
    return (
      <Card className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <AlertCircle className="h-8 w-8 text-apple-red" />
        </div>
        <div><p className="font-medium text-ink-secondary">加载失败</p><p className="mt-1 break-all text-sm text-apple-red">{loadError}</p></div>
      </Card>
    );
  }

  if (papers.length === 0 && interests.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <FileText className="h-8 w-8 text-ink-tertiary" />
        </div>
        <div><p className="font-medium text-ink-secondary">还没有论文</p><p className="mt-1 text-sm text-ink-tertiary">上传第一篇 PDF，小妍帮你精读和分析。</p></div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {paperGroups.map((group) => (
        <CollapsibleGroup key={group.key} title={group.title}
          subtitle={group.subtitle !== group.title ? `研究主题：${group.subtitle}` : undefined}
          countLabel={`${group.papers.length} 篇`} defaultOpen={group.papers.length > 0}
          bodyClassName="space-y-3"
          actions={
            confirmDeleteGroupId === group.key ? (
              <>
                <span className="text-xs text-ink-tertiary">删除文件夹：</span>
                <Button size="sm" variant="secondary" loading={deletingGroupId === group.key}
                  onClick={() => onDeleteInterestGroup(group.key, false)}>置为未归档</Button>
                <Button size="sm" variant="secondary" loading={deletingGroupId === group.key}
                  onClick={() => onDeleteInterestGroup(group.key, true)}>删除全部</Button>
                <button type="button" onClick={() => setConfirmDeleteGroupId(null)}
                  className="text-ink-tertiary hover:text-ink-primary"><X className="h-3.5 w-3.5" /></button>
              </>
            ) : (
              <>
                {renderGroupControls(group.key)}
                <button type="button" onClick={() => setConfirmDeleteGroupId(group.key)}
                  className="text-ink-tertiary/40 transition-colors hover:text-apple-red"><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )
          }>
          {group.papers.length === 0 ? (
            <Card padding="sm" className="border border-dashed border-nm-dark/10 bg-white/25 py-8 text-center text-sm text-ink-tertiary">
              这个方向下还没有论文，上传 PDF 后会显示在这里。
            </Card>
          ) : (
            group.papers.map((p) => renderPaperCard(p, group.key))
          )}
        </CollapsibleGroup>
      ))}

      {ungroupedPapers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <p className="text-sm font-semibold text-ink-primary">未归档论文</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">暂未绑定主题，编辑后可移动到研究主题。</p>
            </div>
            {renderGroupControls("ungrouped")}
          </div>
          {ungroupedPapers.map((p) => renderPaperCard(p, "ungrouped"))}
        </section>
      )}
    </div>
  );
}
