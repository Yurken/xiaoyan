import { useCallback, useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { Loader2 } from "lucide-react";
import { Button } from "@research-copilot/ui";
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
import SubmissionTabs from "../features/submission/SubmissionTabs";
import SubmissionTimelineStrip from "../features/submission/SubmissionTimelineStrip";
import VenueTrackerWorkspace from "../features/submission/VenueTrackerWorkspace";
import AddVenueModal from "../features/submission/AddVenueModal";
import VenueRecommendationsPanel from "../features/submission/VenueRecommendationsPanel";
import KanbanWorkspace from "../features/submission/KanbanWorkspace";
import AddSubmissionModal from "../features/submission/AddSubmissionModal";
import SubmissionPaperSidebar from "../features/submission/SubmissionPaperSidebar";
import ReviewWorkspace from "../features/submission/ReviewWorkspace";
import ReviewEntryModal from "../features/submission/ReviewEntryModal";
import MockReviewModal from "../features/submission/MockReviewModal";
import ChecklistWorkspace from "../features/submission/ChecklistWorkspace";
import DiagnosisReportPanel from "../features/submission/DiagnosisReportPanel";
import RevisionTaskPanel from "../features/submission/RevisionTaskPanel";
import VersionWorkspace from "../features/submission/VersionWorkspace";
import SaveVersionModal from "../features/submission/SaveVersionModal";
import RejectionRecoveryPanel from "../features/submission/RejectionRecoveryPanel";
import CoverLetterModal from "../features/submission/CoverLetterModal";
import PolishPanel from "../features/submission/PolishPanel";
import { SUBMISSION_TAB_KEYS, submissionApi } from "../features/submission/shared";
import type {
  SubmissionTab, SaveVersionFormState, MockReviewerResult, ReviewVerdict,
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
  useEffect(() => {
    let unlistenR: (() => void) | undefined, unlistenD: (() => void) | undefined, unlistenE: (() => void) | undefined;
    listen<{ submissionId: string; index: number; reviewer: string; raw: string }>("submission:ai_review:reviewer",
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
      }).then(u => { unlistenR = u; });
    listen<{ submissionId: string }>("submission:ai_review:done", ({ payload }) => {
      if (payload.submissionId !== activeMockSubRef.current) return;
      review.setMockLoading(false);
      if (payload.submissionId === checklist.checklistSubId) void diagnosis.refreshReports();
    }).then(u => { unlistenD = u; });
    listen<{ submissionId: string; error: string }>("submission:ai_review:error", ({ payload }) => {
      if (payload.submissionId !== activeMockSubRef.current) return;
      review.setMockLoading(false); showError(payload.error);
    }).then(u => { unlistenE = u; });
    return () => { unlistenR?.(); unlistenD?.(); unlistenE?.(); };
  }, [checklist.checklistSubId, diagnosis, review, showError]);

  // Cover letter / polish event listeners
  useEffect(() => {
    let u1: (() => void) | undefined, u2: (() => void) | undefined;
    listen<{ submissionId: string; delta: string }>("submission:cover_letter:delta",
      ({ payload }) => { setCoverLetterText(prev => prev + payload.delta); }).then(u => { u1 = u; });
    listen<{ submissionId: string; fullText: string }>("submission:cover_letter:done",
      ({ payload }) => { setCoverLetterText(payload.fullText); setCoverLetterLoading(false); }).then(u => { u2 = u; });
    return () => { u1?.(); u2?.(); };
  }, []);
  useEffect(() => {
    let u1: (() => void) | undefined, u2: (() => void) | undefined;
    listen<{ submissionId: string; delta: string }>("submission:polish:delta", ({ payload }) => {
      if (payload.submissionId === review.subId || payload.submissionId === versionSubId) setPolishText(prev => prev + payload.delta);
    }).then(u => { u1 = u; });
    listen<{ submissionId: string; fullText: string }>("submission:polish:done",
      ({ payload }) => { setPolishText(payload.fullText); setPolishLoading(false); }).then(u => { u2 = u; });
    return () => { u1?.(); u2?.(); };
  }, [review.subId, versionSubId]);

  // DDL sync
  const [syncingDdl, setSyncingDdl] = useState(false);
  const handleSyncDdl = async () => {
    setSyncingDdl(true);
    try {
      const result = await submissionApi.syncDeadlines();
      const venueCount = result?.venue_count ?? 0;
      setFeedback(venueCount > 0 ? `已同步 ${venueCount} 个期刊/会议的截止日期` : "没有需要更新的截止日期");
    } catch (err) { showError(err); }
    finally { setSyncingDdl(false); }
  };

  return (
    <div className="rc-app-page space-y-4">
      <SubmissionPageHeader feedback={feedback} onClearFeedback={() => setFeedback("")} />

      <SubmissionTabs tab={tab} onTabChange={setTab} extra={
        tab === "conferences" ? (
          <div className="flex items-center gap-2">
            <Button onClick={handleSyncDdl} loading={syncingDdl} size="sm" variant="secondary">
              {syncingDdl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              同步 DDL
            </Button>
            <Button onClick={() => venues.setShowAddModal(true)} size="sm">添加会议 / 期刊</Button>
          </div>
        ) : tab === "board" ? (
          <Button onClick={() => board.setShowAddSubModal(true)} size="sm">创建投稿</Button>
        ) : null
      } />

      <div className="min-h-0 flex-1 space-y-4">
        {tab === "conferences" && (
          <VenueTrackerWorkspace
            venues={venues.visibleVenues} filter={venues.venueFilter} onFilterChange={venues.setVenueFilter}
            onToggleStar={venues.toggleVenueStar} submissions={board.submissions}
          />
        )}
        {tab === "board" && (
          <KanbanWorkspace
            submissions={board.submissions} onMove={board.moveSubmission} rejectionPlans={rejectionPlans}
            onSelectVersion={(id) => { setVersionSubId(id); setTab("versions"); }}
            onSelectReview={(id) => { review.setSubId(id); setTab("reviews"); }}
            onSelectChecklist={(id) => { checklist.setChecklistSubId(id); setTab("checklist"); }}
          />
        )}
        {tab === "reviews" && <ReviewWorkspace
          subId={review.subId} submissions={board.submissions}
          onSelectSubId={review.setSubId}
          rounds={review.rounds} comments={review.comments}
          onSelectRound={review.setRound}
          onAddComment={() => review.setShowAddModal(true)}
          onMockReview={(subId) => {
            activeMockSubRef.current = subId;
            review.setMockResult(null);
            review.setShowMockModal(true);
          }}
        />}
        {tab === "checklist" && <ChecklistWorkspace
          subId={checklist.checklistSubId} submissions={board.submissions}
          onSelectSubId={checklist.setChecklistSubId}
          cat={checklist.checklistCat}
          onCatChange={checklist.setChecklistCat}
          categories={checklist.visibleCategories}
          items={checklist.filteredChecklist}
          checkedCount={checklist.checkedCount}
          progress={checklist.progress}
          onToggle={checklist.toggleCheck}
          onReset={checklist.resetChecklist}
          diagnosisPanel={
            <DiagnosisReportPanel
              reports={diagnosis.reports}
              loading={diagnosis.diagnosisLoading}
              importingReportId={diagnosis.importingDiagnosisReportId}
              onImport={diagnosis.importReportToChecklist}
              onRefresh={diagnosis.refreshReports}
            />
          }
          revisionPanel={
            <RevisionTaskPanel
              tasks={revision.revisionTasks}
              versions={revision.revisionVersions}
              experiments={revision.revisionExperiments}
              loading={revision.revisionLoading}
              importingReportId={revision.importingRevisionTaskReportId}
              onImport={revision.importReportToTasks}
              onUpdate={revision.updateRevisionTask}
            />
          }
        />}
        {tab === "versions" && <VersionWorkspace
          subId={versionSubId} submissions={board.submissions}
          onSelectSubId={setVersionSubId}
          versions={versions} versionCounts={versionCounts}
          compareIds={compareIds} onToggleCompare={setCompareIds}
          onSave={(id, content) => { setVersionSubId(id); setSaveForm(prev => ({ ...prev, content })); setShowSaveModal(true); }}
          onUpdate={patchVersion}
          onPolish={(id, content) => { setPolishSourceId(id); setPolishText(content); setShowPolishPanel(true); }}
          onCoverLetter={(id) => { setVersionSubId(id); setShowCoverLetterModal(true); }}
          rejectionPlans={rejectionPlans}
        />}
        {tab === "timeline" && <SubmissionTimelineStrip submissions={board.submissions} />}
      </div>

      {/* Modals */}
      {venues.showAddModal && <AddVenueModal
        search={venues.addModalSearch} area={venues.addModalAreaFilter} type={venues.addModalTypeFilter}
        areas={venues.areas} templates={venues.filteredVenueTemplates}
        loading={venues.venueTemplateLoading}
        onSearchChange={venues.setAddModalSearch} onAreaChange={venues.setAddModalAreaFilter}
        onTypeChange={venues.setAddModalTypeFilter}
        onAdd={venues.handleAddVenue} isAdded={venues.isVenueAdded}
        onClose={() => venues.setShowAddModal(false)}
      />}
      {tab === "conferences" && <VenueRecommendationsPanel
        input={venues.recInput} onInputChange={venues.setRecInput}
        recommendations={venues.recommendations} loading={venues.recLoading}
        onGenerate={venues.generateRecommendations} isAdded={venues.isVenueAdded}
        onAddVenue={venues.handleAddVenue}
      />}
      {board.showAddSubModal && <AddSubmissionModal
        form={board.addSubForm} onChange={board.setAddSubForm}
        venues={venues.conferences.concat(venues.journals)}
        onSave={() => { void board.handleAddSubmission(); }}
        onCancel={() => board.setShowAddSubModal(false)}
      />}
      {tab !== "conferences" && <SubmissionPaperSidebar
        submissions={board.submissions} activeSubId={
          tab === "versions" ? versionSubId : tab === "reviews" ? review.subId : tab === "checklist" ? checklist.checklistSubId : undefined
        }
        onSelect={(id) => {
          if (tab === "versions") setVersionSubId(id);
          else if (tab === "reviews") review.setSubId(id);
          else if (tab === "checklist") checklist.setChecklistSubId(id);
        }}
      />}
      {review.showAddModal && <ReviewEntryModal
        subId={review.subId} round={review.round} form={review.form}
        onChange={review.setForm} onSave={() => void review.handleReviewSubmit()}
        onCancel={() => review.setShowAddModal(false)}
      />}
      {review.showMockModal && <MockReviewModal
        input={review.mockInput} onChange={review.setMockInput}
        loading={review.mockLoading} result={review.mockResult}
        fileExtracting={review.mockFileExtracting} fileName={review.mockFileName}
        onStart={(subId, input) => {
          activeMockSubRef.current = subId;
          mockBufferRef.current = [];
          review.setMockLoading(true);
        }}
        onCancel={() => { review.setShowMockModal(false); review.setMockResult(null); }}
        onExtractFile={async (path) => {
          review.setMockFileExtracting(true);
          try {
            const text = await submissionApi.extractPaperText(path);
            review.setMockInput(prev => ({ ...prev, abstract: text.slice(0, 5000) }));
            review.setMockFileName(path.split("/").pop() ?? null);
          } catch (err) { showError(err); }
          finally { review.setMockFileExtracting(false); }
        }}
      />}
      {showSaveModal && <SaveVersionModal
        form={saveForm} onChange={setSaveForm}
        onSave={() => { void appendVersion(versionSubId, saveForm); setShowSaveModal(false); }}
        onCancel={() => setShowSaveModal(false)}
      />}
      {showCoverLetterModal && <CoverLetterModal
        subId={versionSubId} loading={coverLetterLoading} text={coverLetterText}
        onGenerate={async (subId, title, venue, type, rounds, comments) => {
          setCoverLetterLoading(true); setCoverLetterText("");
          try { await submissionApi.generateCoverLetter(subId, title, venue, type, rounds, comments); }
          catch (err) { showError(err); setCoverLetterLoading(false); }
        }}
        onClose={() => { setShowCoverLetterModal(false); setCoverLetterText(""); }}
        onSubmit={(subId) => board.submissions.find(s => s.id === subId)?.title ?? ""}
      />}
      {showPolishPanel && <PolishPanel
        subId={polishSourceId} text={polishText} loading={polishLoading}
        onPolish={async (subId, text) => { setPolishLoading(true); setPolishText("");
          try { await submissionApi.polish(subId, text); } catch (err) { showError(err); setPolishLoading(false); }
        }}
        onClose={() => { setShowPolishPanel(false); setPolishText(""); }}
      />}
    </div>
  );
}
