import { useCallback, useState, useEffect, useRef } from "react";
import { safeListen } from "../lib/tauriEvent";
import { formatErrorMessage } from "../lib/client";
import { usePersistentStringState } from "../hooks/usePersistentStringState";
import { useSubmissionVenues } from "../features/submission/useSubmissionVenues";
import { useSubmissionBoard } from "../features/submission/useSubmissionBoard";
import { useRejectionRecovery } from "../features/submission/useRejectionRecovery";
import { useSubmissionVersions } from "../features/submission/useSubmissionVersions";
import { useSubmissionChecklist } from "../features/submission/useSubmissionChecklist";
import { useSubmissionDiagnosisReports } from "../features/submission/useSubmissionDiagnosisReports";
import { useSubmissionRevisionTasks } from "../features/submission/useSubmissionRevisionTasks";
import { useSubmissionReview } from "../features/submission/useSubmissionReview";
import SubmissionPageHeader from "../features/submission/SubmissionPageHeader";
import SubmissionFeedbackBanner from "../features/submission/SubmissionFeedbackBanner";
import VenueTrackerWorkspace from "../features/submission/VenueTrackerWorkspace";
import AddVenueModal from "../features/submission/AddVenueModal";
import KanbanWorkspace from "../features/submission/KanbanWorkspace";
import AddSubmissionModal from "../features/submission/AddSubmissionModal";
import ReviewWorkspace from "../features/submission/ReviewWorkspace";
import ReviewEntryModal from "../features/submission/ReviewEntryModal";
import MockReviewModal from "../features/submission/MockReviewModal";
import ChecklistWorkspace from "../features/submission/ChecklistWorkspace";
import VersionWorkspace from "../features/submission/VersionWorkspace";
import SaveVersionModal from "../features/submission/SaveVersionModal";
import CoverLetterModal from "../features/submission/CoverLetterModal";
import PolishPanel from "../features/submission/PolishPanel";
import { SUBMISSION_TAB_KEYS, type SubmissionTab } from "../features/submission/SubmissionTabs";
import { papersApi, submissionApi } from "../lib/client";
import type { PaperVersion } from "../features/submission/shared";
import type {
  SaveVersionFormState, MockReviewerResult, ReviewVerdict,
} from "../features/submission/shared";

export default function Submission() {
  const [feedback, setFeedback] = useState("");
  const showError = useCallback((error: unknown) => setFeedback(formatErrorMessage(error)), []);
  const [tab, setTab] = usePersistentStringState<SubmissionTab>("rc:submission:active-tab", "conferences", SUBMISSION_TAB_KEYS);

  const venues = useSubmissionVenues(showError);
  const board = useSubmissionBoard(showError);
  const rejectionPlans = useRejectionRecovery(board.submissions);
  const review = useSubmissionReview(showError);

  const [versionSubId, setVersionSubId] = useState<string>("");
  const { versions, versionCounts, appendVersion, patchVersion } = useSubmissionVersions(
    board.submissions, versionSubId, showError,
  );
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveVersionFormState>({ tag: "", label: "", notes: "", content: "" });

  const checklist = useSubmissionChecklist(board.submissions, showError);
  const handleDiagnosisImported = useCallback(async (created: number) => {
    await checklist.reloadChecklist();
    setFeedback(created > 0 ? `已转入 ${created} 条诊断清单` : "诊断清单已是最新");
  }, [checklist]);
  const diagnosis = useSubmissionDiagnosisReports(checklist.checklistSubId, {
    onError: showError, onImported: handleDiagnosisImported,
  });
  const revision = useSubmissionRevisionTasks(checklist.checklistSubId, {
    onError: showError,
    onImported: (created: number) => setFeedback(created > 0 ? `已转入 ${created} 个修改任务` : "修改任务已是最新"),
  });

  // Cover letter / polish state
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [showPolishPanel, setShowPolishPanel] = useState(false);
  const [polishText, setPolishText] = useState("");
  const [polishLoading, setPolishLoading] = useState(false);
  const [polishSourceId, setPolishSourceId] = useState<string>("");

  useEffect(() => {
    if (board.submissions.length === 0) return;
    if (!versionSubId) setVersionSubId(board.submissions[0].id);
    if (!review.subId) review.setSubId(board.submissions[0].id);
  }, [board.submissions, versionSubId, review.subId, review]);

  // AI review event listeners
  const mockBufferRef = useRef<MockReviewerResult[]>([]);
  const activeMockSubRef = useRef<string>("");
  // 当前正在生成 cover letter / 润色的投稿，用于过滤对应流式事件，隔离多投稿并发。
  const activeCoverSubRef = useRef<string>("");
  const activePolishSubRef = useRef<string>("");
  // ai_review 监听只在 mount 注册一次（依赖 [showError]），故对会变化的值用 ref 读取，
  // 避免 review/diagnosis 每次渲染换引用导致反复重订阅、在异步重注册窗口内丢失 reviewer 事件。
  const checklistSubIdRef = useRef(checklist.checklistSubId);
  checklistSubIdRef.current = checklist.checklistSubId;
  const refreshReportsRef = useRef(diagnosis.refreshReports);
  refreshReportsRef.current = diagnosis.refreshReports;
  useEffect(() => {
    let unlistenR: (() => void) | undefined, unlistenD: (() => void) | undefined, unlistenE: (() => void) | undefined;
    let mounted = true;
    safeListen<{ submissionId: string; index: number; reviewer: string; raw: string }>("submission:ai_review:reviewer",
      ({ payload }) => {
        if (payload.submissionId !== activeMockSubRef.current) return;
        try {
          const parsed = JSON.parse(payload.raw);
          const result = { reviewer: payload.reviewer, content: [
            parsed.summary ? `**Summary:** ${parsed.summary}` : "",
            parsed.strengths?.length ? `**Strengths:**\n${(parsed.strengths as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
            parsed.weaknesses?.length ? `**Weaknesses:**\n${(parsed.weaknesses as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
            parsed.questions?.length ? `**Questions:**\n${(parsed.questions as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
          ].filter(Boolean).join("\n\n"), tags: [], verdict: (
            parsed.verdict === "accept" ? "accept" : parsed.verdict === "weak_accept" ? "minor_revision"
            : parsed.verdict === "weak_reject" ? "major_revision" : "reject") as ReviewVerdict };
          mockBufferRef.current = [...mockBufferRef.current, result];
          review.setMockResult([...mockBufferRef.current]);
        } catch {
          mockBufferRef.current = [...mockBufferRef.current, {
            reviewer: payload.reviewer, content: payload.raw, tags: [], verdict: "major_revision" as ReviewVerdict,
          }];
          review.setMockResult([...mockBufferRef.current]);
        }
      }).then(u => { if (!mounted) { u(); return; } unlistenR = u; });
    safeListen<{ submissionId: string }>("submission:ai_review:done", ({ payload }) => {
      if (payload.submissionId !== activeMockSubRef.current) return;
      review.setMockLoading(false);
      if (payload.submissionId === checklistSubIdRef.current) void refreshReportsRef.current();
    }).then(u => { if (!mounted) { u(); return; } unlistenD = u; });
    safeListen<{ submissionId: string; error: string }>("submission:ai_review:error", ({ payload }) => {
      if (payload.submissionId !== activeMockSubRef.current) return;
      review.setMockLoading(false); showError(payload.error);
    }).then(u => { if (!mounted) { u(); return; } unlistenE = u; });
    return () => {
      mounted = false;
      unlistenR?.(); unlistenD?.(); unlistenE?.();
      unlistenR = undefined; unlistenD = undefined; unlistenE = undefined;
    };
    // review 的 setMockResult/setMockLoading 是稳定的 useState setter，只在 mount 捕获一次即可；
    // 刻意不依赖 review/diagnosis，避免它们每次渲染换引用导致重订阅丢事件。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  // Cover letter / polish event listeners
  // 均按 active*SubRef 过滤，避免多投稿并发时一路流式结果串写到另一路面板；
  // 同时监听 error 事件，防止流式中途失败导致面板永久停在 loading。
  useEffect(() => {
    let u1: (() => void) | undefined, u2: (() => void) | undefined, u3: (() => void) | undefined;
    let mounted = true;
    safeListen<{ submissionId: string; delta: string }>("submission:cover_letter:delta", ({ payload }) => {
      if (payload.submissionId !== activeCoverSubRef.current) return;
      setCoverLetterText(prev => prev + payload.delta);
    }).then(u => { if (!mounted) { u(); return; } u1 = u; });
    safeListen<{ submissionId: string; fullText: string }>("submission:cover_letter:done", ({ payload }) => {
      if (payload.submissionId !== activeCoverSubRef.current) return;
      setCoverLetterText(payload.fullText); setCoverLetterLoading(false);
    }).then(u => { if (!mounted) { u(); return; } u2 = u; });
    safeListen<{ submissionId: string; error: string }>("submission:cover_letter:error", ({ payload }) => {
      if (payload.submissionId !== activeCoverSubRef.current) return;
      setCoverLetterLoading(false); showError(payload.error);
    }).then(u => { if (!mounted) { u(); return; } u3 = u; });
    return () => {
      mounted = false;
      u1?.(); u2?.(); u3?.();
      u1 = undefined; u2 = undefined; u3 = undefined;
    };
  }, [showError]);
  useEffect(() => {
    let u1: (() => void) | undefined, u2: (() => void) | undefined, u3: (() => void) | undefined;
    let mounted = true;
    safeListen<{ submissionId: string; delta: string }>("submission:polish:delta", ({ payload }) => {
      if (payload.submissionId !== activePolishSubRef.current) return;
      setPolishText(prev => prev + payload.delta);
    }).then(u => { if (!mounted) { u(); return; } u1 = u; });
    safeListen<{ submissionId: string; fullText: string }>("submission:polish:done", ({ payload }) => {
      if (payload.submissionId !== activePolishSubRef.current) return;
      setPolishText(payload.fullText); setPolishLoading(false);
    }).then(u => { if (!mounted) { u(); return; } u2 = u; });
    safeListen<{ submissionId: string; error: string }>("submission:polish:error", ({ payload }) => {
      if (payload.submissionId !== activePolishSubRef.current) return;
      setPolishLoading(false); showError(payload.error);
    }).then(u => { if (!mounted) { u(); return; } u3 = u; });
    return () => {
      mounted = false;
      u1?.(); u2?.(); u3?.();
      u1 = undefined; u2 = undefined; u3 = undefined;
    };
  }, [showError]);

  // DDL sync
  const [syncingDdl, setSyncingDdl] = useState(false);
  const handleSyncDdl = async () => {
    setSyncingDdl(true);
    try {
      let result = await submissionApi.syncCcfDdl();
      // 在线接口受 GitHub 速率限制/离线影响时回退到内置数据
      if ((result?.fetched ?? 0) === 0) {
        result = await submissionApi.syncCcfDdlLocal();
      }
      const venueCount = result?.updated ?? 0;
      setFeedback(venueCount > 0 ? `已同步 ${venueCount} 个期刊/会议的截止日期` : "没有需要更新的截止日期");
    } catch (err) { showError(err); }
    finally { setSyncingDdl(false); }
  };

  // 版本文件：上传后写回版本记录，下载则交由系统打开文件
  const handleUploadVersionFile = async (versionId: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, filters: [{ name: "文档", extensions: ["pdf", "tex", "docx", "md", "txt"] }] });
      if (typeof selected !== "string") return;
      const fileName = selected.split("/").pop() ?? selected;
      await patchVersion(versionId, { filePath: selected, fileName });
    } catch (err) { showError(err); }
  };
  const handleDownloadVersionFile = async (filePath?: string) => {
    if (!filePath) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(filePath);
    } catch (err) { showError(err); }
  };

  // 记录版本快照：写库并写回本地状态
  const handleSaveVersion = async () => {
    if (!versionSubId) return;
    try {
      const response = await submissionApi.createVersion({
        submissionId: versionSubId,
        tag: saveForm.tag || undefined,
        label: saveForm.label || undefined,
        content: saveForm.content || undefined,
        notes: saveForm.notes || undefined,
      });
      const created: PaperVersion = {
        id: response.id,
        submissionId: versionSubId,
        tag: saveForm.tag,
        label: saveForm.label,
        stage: "writing",
        content: saveForm.content,
        notes: saveForm.notes,
        createdAt: new Date(),
      };
      appendVersion(created);
      setShowSaveModal(false);
      setSaveForm({ tag: "", label: "", notes: "", content: "" });
    } catch (err) { showError(err); }
  };

  // 模拟审稿：选 PDF 提取文本、触发生成、导入归档
  const handlePickMockPdf = async () => {
    review.setMockFileExtracting(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] });
      if (typeof selected !== "string") return;
      const text = await papersApi.extractPdfText(selected, 8000);
      review.setMockInput(prev => ({ ...prev, abstract: text.slice(0, 5000) }));
      review.setMockFileName(selected.split("/").pop() ?? null);
    } catch (err) { showError(err); }
    finally { review.setMockFileExtracting(false); }
  };
  const handleGenerateMockReview = () => {
    const submissionId = activeMockSubRef.current || review.subId;
    if (!submissionId) return;
    activeMockSubRef.current = submissionId;
    mockBufferRef.current = [];
    review.setMockResult(null);
    review.setMockLoading(true);
    submissionApi.aiReview({
      submissionId,
      content: review.mockInput.abstract,
      reviewerCount: review.mockInput.reviewerCount,
      strictness: review.mockInput.strictness,
    }).catch((err) => { review.setMockLoading(false); showError(err); });
  };
  const handleImportMockReview = async () => {
    const submissionId = activeMockSubRef.current || review.subId;
    const results = review.mockResult ?? [];
    if (!submissionId || results.length === 0) return;
    try {
      await submissionApi.upsertRound({ submissionId, round: review.round });
      for (const result of results) {
        await submissionApi.createComment({
          submissionId, round: review.round,
          reviewer: result.reviewer, content: result.content, tags: result.tags,
        });
      }
      review.setShowMockModal(false);
      review.setMockResult(null);
      if (submissionId === review.subId) review.reloadReview();
      setFeedback(`已导入 ${results.length} 条模拟审稿意见`);
    } catch (err) { showError(err); }
  };

  // Cover letter：打开弹窗即触发流式生成（监听器写入 coverLetterText）
  const handleOpenCoverLetter = (submissionId: string) => {
    if (!submissionId) return;
    activeCoverSubRef.current = submissionId;
    setVersionSubId(submissionId);
    setCoverLetterText("");
    setCoverLetterLoading(true);
    setShowCoverLetterModal(true);
    submissionApi.generateCoverLetter(submissionId).catch((err) => { setCoverLetterLoading(false); showError(err); });
  };

  // 润色：打开面板即触发流式润色（监听器写入 polishText）
  const handlePolishVersion = (version: PaperVersion) => {
    activePolishSubRef.current = version.submissionId;
    setPolishSourceId(version.id);
    setPolishText("");
    setPolishLoading(true);
    setShowPolishPanel(true);
    submissionApi.polishAbstract(version.submissionId, version.content).catch((err) => { setPolishLoading(false); showError(err); });
  };
  const handleApplyPolish = () => {
    if (!polishSourceId) { setShowPolishPanel(false); return; }
    void patchVersion(polishSourceId, { content: polishText }).catch(showError);
    setShowPolishPanel(false);
    setPolishText("");
  };

  return (
    <div className="rc-app-page space-y-4">
      <SubmissionPageHeader
        activeTab={tab}
        conferencesCount={venues.conferences.length}
        journalsCount={venues.journals.length}
        activeCount={board.submissions.filter(s => s.status !== "accepted" && s.status !== "rejected").length}
        acceptedCount={board.submissions.filter(s => s.status === "accepted").length}
        onTabChange={setTab}
      />

      <SubmissionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback("")} />

      <div className="min-h-0 flex-1 space-y-4">
        {tab === "conferences" && (
          <VenueTrackerWorkspace
            venueFilter={venues.venueFilter}
            visibleVenues={venues.visibleVenues}
            conferencesCount={venues.conferences.length}
            journalsCount={venues.journals.length}
            recommendations={venues.recommendations}
            recommendationLoading={venues.recLoading}
            recommendationInput={venues.recInput}
            researchInterests={venues.interests}
            selectedRecommendationInterestId={venues.recInterestId}
            onVenueFilterChange={venues.setVenueFilter}
            onOpenAddVenue={() => venues.setShowAddModal(true)}
            onChangeRecommendationInput={venues.setRecInput}
            onSelectRecommendationInterest={venues.setRecInterestId}
            onRecommendFromInterest={venues.recommendFromInterest}
            onGenerateRecommendations={venues.generateRecommendations}
            isVenueAdded={venues.isVenueAdded}
            onAddVenue={venues.handleAddVenue}
            onCreateSubmissionFromRecommendation={(recommendation) => {
              board.setAddSubForm({
                title: venues.recInput.title.trim(),
                venue: recommendation.name,
                venueType: recommendation.type,
                deadline: "",
              });
              board.setShowAddSubModal(true);
            }}
            onToggleVenueStar={venues.toggleVenueStar}
            onSyncDdl={handleSyncDdl}
            syncingDdl={syncingDdl}
          />
        )}
        {tab === "kanban" && (
          <KanbanWorkspace
            submissions={board.submissions}
            rejectionRecoveryPlans={rejectionPlans}
            onOpenAddSubmission={() => board.setShowAddSubModal(true)}
            onMoveSubmission={board.moveSubmission}
            onPrepareTransfer={(plan, target) => {
              board.setAddSubForm({
                title: plan.submission.title,
                venue: target.name,
                venueType: target.type,
                deadline: "",
              });
              board.setShowAddSubModal(true);
            }}
          />
        )}
        {tab === "reviews" && <ReviewWorkspace
          submissions={board.submissions}
          reviewSubId={review.subId}
          reviewComments={review.comments}
          reviewRounds={review.rounds}
          reviewRound={review.round}
          onSelectSubmission={review.setSubId}
          onSelectRound={review.setRound}
          onOpenCoverLetter={() => handleOpenCoverLetter(review.subId)}
          onOpenAddReview={() => review.setShowAddModal(true)}
          onToggleResolved={review.toggleResolved}
          onUpdateResponse={review.updateResponse}
        />}
        {tab === "checklist" && <ChecklistWorkspace
          submissions={board.submissions}
          checklistSubId={checklist.checklistSubId}
          checklist={checklist.checklist}
          checklistCat={checklist.checklistCat}
          categories={checklist.categories}
          visibleCategories={checklist.visibleCategories}
          filteredChecklist={checklist.filteredChecklist}
          diagnosisReports={diagnosis.reports}
          diagnosisLoading={diagnosis.loading}
          importingDiagnosisReportId={diagnosis.importingReportId}
          revisionTasks={revision.tasks}
          revisionVersions={revision.versions}
          revisionExperiments={revision.experiments}
          revisionLoading={revision.loading}
          importingRevisionTaskReportId={revision.importingReportId}
          updatingRevisionTaskId={revision.updatingTaskId}
          checkedCount={checklist.checkedCount}
          progress={checklist.progress}
          onSelectSubmission={checklist.setChecklistSubId}
          onReset={checklist.resetChecklist}
          onSelectCategory={checklist.setChecklistCat}
          onToggleCheck={checklist.toggleCheck}
          onImportDiagnosisReport={diagnosis.importReportToChecklist}
          onImportDiagnosisTasks={revision.importReportToTasks}
          onUpdateRevisionTask={revision.updateTask}
        />}
        {tab === "versions" && <VersionWorkspace
          submissions={board.submissions}
          versions={versions}
          versionCounts={versionCounts}
          versionSubId={versionSubId}
          compareIds={compareIds}
          onSelectSubmission={setVersionSubId}
          onSetCompareIds={setCompareIds}
          onOpenSaveModal={() => {
            const latest = versions[0];
            setSaveForm(prev => ({ ...prev, content: latest?.content ?? "" }));
            setShowSaveModal(true);
          }}
          onUploadVersionFile={handleUploadVersionFile}
          onDownloadVersionFile={handleDownloadVersionFile}
          onPolishVersion={handlePolishVersion}
          onOpenMockReview={(version) => {
            activeMockSubRef.current = version.submissionId;
            mockBufferRef.current = [];
            review.setMockResult(null);
            review.setMockFileName(null);
            review.setMockInput(prev => ({ ...prev, abstract: version.content }));
            review.setShowMockModal(true);
          }}
        />}
      </div>

      {/* Modals */}
      <AddVenueModal
        open={venues.showAddModal}
        search={venues.addModalSearch}
        areaFilter={venues.addModalAreaFilter}
        typeFilter={venues.addModalTypeFilter}
        areas={venues.areas}
        filteredVenueTemplates={venues.filteredVenueTemplates}
        loading={venues.venueTemplateLoading}
        trackedCount={venues.conferences.length + venues.journals.length}
        onSearchChange={venues.setAddModalSearch}
        onAreaFilterChange={venues.setAddModalAreaFilter}
        onTypeFilterChange={venues.setAddModalTypeFilter}
        onAddVenue={venues.handleAddVenue}
        isVenueAdded={venues.isVenueAdded}
        onClose={() => venues.setShowAddModal(false)}
      />
      <AddSubmissionModal
        open={board.showAddSubModal}
        form={board.addSubForm}
        onSetForm={board.setAddSubForm}
        onSubmit={() => { void board.handleAddSubmission(); }}
        onClose={() => board.setShowAddSubModal(false)}
      />
      <ReviewEntryModal
        open={review.showAddModal}
        currentVenue={board.submissions.find(s => s.id === review.subId)?.venue}
        reviewRound={review.round}
        reviewRounds={review.rounds}
        reviewSubId={review.subId}
        reviewForm={review.form}
        onSetReviewForm={review.setForm}
        onSubmit={() => void review.handleReviewSubmit()}
        onClose={() => review.setShowAddModal(false)}
      />
      <MockReviewModal
        open={review.showMockModal}
        mockReviewInput={review.mockInput}
        mockReviewResult={review.mockResult}
        mockReviewLoading={review.mockLoading}
        mockFileExtracting={review.mockFileExtracting}
        mockFileName={review.mockFileName}
        onSetInput={review.setMockInput}
        onPickPdf={handlePickMockPdf}
        onReset={() => { mockBufferRef.current = []; review.setMockResult(null); }}
        onImport={handleImportMockReview}
        onGenerate={handleGenerateMockReview}
        onClose={() => { review.setShowMockModal(false); review.setMockResult(null); }}
      />
      <SaveVersionModal
        open={showSaveModal}
        versionNextTag={`v${versions.length + 1}`}
        form={saveForm}
        onSetForm={setSaveForm}
        onSubmit={handleSaveVersion}
        onClose={() => setShowSaveModal(false)}
      />
      <CoverLetterModal
        open={showCoverLetterModal}
        text={coverLetterText}
        loading={coverLetterLoading}
        onChangeText={setCoverLetterText}
        onClose={() => { setShowCoverLetterModal(false); setCoverLetterText(""); }}
      />
      <PolishPanel
        open={showPolishPanel}
        text={polishText}
        loading={polishLoading}
        onChangeText={setPolishText}
        onApply={handleApplyPolish}
        onClose={() => { setShowPolishPanel(false); setPolishText(""); }}
      />
    </div>
  );
}
