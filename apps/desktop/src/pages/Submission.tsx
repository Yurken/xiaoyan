import { useCallback, useState, useEffect, useRef } from "react";
import { formatErrorMessage, submissionApi } from "../lib/client";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import AddSubmissionModal from "../features/submission/AddSubmissionModal";
import AddVenueModal from "../features/submission/AddVenueModal";
import ChecklistWorkspace from "../features/submission/ChecklistWorkspace";
import CoverLetterModal from "../features/submission/CoverLetterModal";
import KanbanWorkspace from "../features/submission/KanbanWorkspace";
import MockReviewModal from "../features/submission/MockReviewModal";
import PolishPanel from "../features/submission/PolishPanel";
import ReviewEntryModal from "../features/submission/ReviewEntryModal";
import ReviewWorkspace from "../features/submission/ReviewWorkspace";
import SaveVersionModal from "../features/submission/SaveVersionModal";
import SubmissionFeedbackBanner from "../features/submission/SubmissionFeedbackBanner";
import SubmissionPageHeader from "../features/submission/SubmissionPageHeader";
import { SUBMISSION_TAB_KEYS, type SubmissionTab } from "../features/submission/SubmissionTabs";
import { useSubmissionBoard } from "../features/submission/useSubmissionBoard";
import { useSubmissionChecklist } from "../features/submission/useSubmissionChecklist";
import { useSubmissionDiagnosisReports } from "../features/submission/useSubmissionDiagnosisReports";
import { useSubmissionRevisionTasks } from "../features/submission/useSubmissionRevisionTasks";
import { useRejectionRecovery } from "../features/submission/useRejectionRecovery";
import { useSubmissionVersions } from "../features/submission/useSubmissionVersions";
import { useSubmissionVenues } from "../features/submission/useSubmissionVenues";
import VenueTrackerWorkspace from "../features/submission/VenueTrackerWorkspace";
import VersionWorkspace from "../features/submission/VersionWorkspace";
import { usePersistentStringState } from "../hooks/usePersistentStringState";
import {
  countVerdicts,
  getDominantVerdict,
  rowToComment,
  rowToRound,
  type MockReviewInput,
  type MockReviewerResult,
  type PaperVersion,
  type ReviewComment,
  type ReviewFormState,
  type ReviewRound,
  type ReviewVerdict,
  type SaveVersionFormState,
} from "../features/submission/shared";

export default function Submission() {
  const [syncingDdl, setSyncingDdl] = useState(false);
  const [ddlSyncResult, setDdlSyncResult] = useState("");
  const [feedback, setFeedback] = useState("");
  const showSubmissionError = useCallback((error: unknown) => {
    setFeedback(formatErrorMessage(error));
  }, []);
  const [tab, setTab] = usePersistentStringState<SubmissionTab>(
    "rc:submission:active-tab",
    "conferences",
    SUBMISSION_TAB_KEYS,
  );

  const {
    conferences,
    journals,
    venueFilter,
    visibleVenues,
    showAddModal,
    addModalSearch,
    addModalAreaFilter,
    addModalTypeFilter,
    recInput,
    recommendations,
    recLoading,
    filteredVenueTemplates,
    areas,
    venueTemplateLoading,
    setVenueFilter,
    setShowAddModal,
    setAddModalSearch,
    setAddModalAreaFilter,
    setAddModalTypeFilter,
    setRecInput,
    toggleVenueStar,
    handleAddVenue,
    isVenueAdded,
    generateRecommendations,
  } = useSubmissionVenues(showSubmissionError);
  const {
    submissions,
    showAddSubModal,
    addSubForm,
    setShowAddSubModal,
    setAddSubForm,
    moveSubmission,
    handleAddSubmission,
  } = useSubmissionBoard(showSubmissionError);
  const rejectionRecoveryPlans = useRejectionRecovery(submissions);

  // Version control state
  const [versionSubId, setVersionSubId] = useState<string>("");
  const { versions, versionCounts, appendVersion, patchVersion } = useSubmissionVersions(
    submissions,
    versionSubId,
    showSubmissionError,
  );
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveVersionFormState>({ tag: "", label: "", notes: "", content: "" });

  const {
    checklist,
    checklistCat,
    checklistSubId,
    categories,
    visibleCategories,
    filteredChecklist,
    checkedCount,
    progress,
    setChecklistCat,
    setChecklistSubId,
    toggleCheck,
    resetChecklist,
    reloadChecklist,
  } = useSubmissionChecklist(submissions, showSubmissionError);
  const handleDiagnosisImported = useCallback(
    async (created: number) => {
      await reloadChecklist();
      setFeedback(created > 0 ? `已转入 ${created} 条诊断清单` : "诊断清单已是最新");
    },
    [reloadChecklist],
  );
  const {
    reports: diagnosisReports,
    loading: diagnosisLoading,
    importingReportId: importingDiagnosisReportId,
    refreshReports: refreshDiagnosisReports,
    importReportToChecklist,
  } = useSubmissionDiagnosisReports(checklistSubId, {
    onError: showSubmissionError,
    onImported: handleDiagnosisImported,
  });
  const handleRevisionTasksImported = useCallback((created: number) => {
    setFeedback(created > 0 ? `已转入 ${created} 个修改任务` : "修改任务已是最新");
  }, []);
  const {
    tasks: revisionTasks,
    versions: revisionVersions,
    experiments: revisionExperiments,
    loading: revisionLoading,
    importingReportId: importingRevisionTaskReportId,
    updatingTaskId: updatingRevisionTaskId,
    importReportToTasks,
    updateTask: updateRevisionTask,
  } = useSubmissionRevisionTasks(checklistSubId, {
    onError: showSubmissionError,
    onImported: handleRevisionTasksImported,
  });

  // Review archive state
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [reviewRounds, setReviewRounds] = useState<ReviewRound[]>([]);
  const [reviewSubId, setReviewSubId] = useState<string>("");
  const [reviewRound, setReviewRound] = useState<number>(1);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>({
    reviewer: "", content: "", tags: [] as string[], verdict: "major_revision" as ReviewVerdict,
  });

  // AI review state
  const [showMockReviewModal, setShowMockReviewModal] = useState(false);
  const [mockReviewInput, setMockReviewInput] = useState<MockReviewInput>({
    abstract: "",
    reviewerCount: 3,
    strictness: "balanced",
  });
  const [mockReviewLoading, setMockReviewLoading] = useState(false);
  const [mockReviewResult, setMockReviewResult] = useState<MockReviewerResult[] | null>(null);
  const [mockFileExtracting, setMockFileExtracting] = useState(false);
  const [mockFileName, setMockFileName] = useState<string | null>(null);

  // Cover letter / polish state
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [showPolishPanel, setShowPolishPanel] = useState(false);
  const [polishText, setPolishText] = useState("");
  const [polishLoading, setPolishLoading] = useState(false);
  const [polishSourceId, setPolishSourceId] = useState<string>("");
  const mockReviewBufferRef = useRef<MockReviewerResult[]>([]);
  const activeMockReviewSubmissionRef = useRef<string>("");

  useEffect(() => {
    if (submissions.length === 0) {
      return;
    }

    if (!versionSubId) {
      setVersionSubId(submissions[0].id);
    }
    if (!reviewSubId) {
      setReviewSubId(submissions[0].id);
    }
  }, [reviewSubId, submissions, versionSubId]);

  // Reload rounds + comments when selected review submission changes
  useEffect(() => {
    if (!reviewSubId) return;
    Promise.all([
      submissionApi.listRounds(reviewSubId),
      submissionApi.listComments(reviewSubId),
    ]).then(([roundsRes, commentsRes]) => {
      setReviewRounds(roundsRes.rounds.map(rowToRound));
      setReviewComments(commentsRes.comments.map(rowToComment));
    }).catch(showSubmissionError);
  }, [reviewSubId, showSubmissionError]);

  // AI review event listeners
  useEffect(() => {
    let unlistenReviewer: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    listen<{ submissionId: string; index: number; reviewer: string; raw: string }>(
      "submission:ai_review:reviewer",
      ({ payload }) => {
        if (payload.submissionId !== activeMockReviewSubmissionRef.current) {
          return;
        }
        try {
          const parsed = JSON.parse(payload.raw);
          const result: MockReviewerResult = {
            reviewer: payload.reviewer,
            content: [
              parsed.summary ? `**Summary:** ${parsed.summary}` : "",
              parsed.strengths?.length ? `**Strengths:**\n${(parsed.strengths as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
              parsed.weaknesses?.length ? `**Weaknesses:**\n${(parsed.weaknesses as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
              parsed.questions?.length ? `**Questions:**\n${(parsed.questions as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
            ].filter(Boolean).join("\n\n"),
            tags: ["方法", "实验"],
            verdict: (parsed.verdict === "accept" ? "accept"
              : parsed.verdict === "weak_accept" ? "minor_revision"
              : parsed.verdict === "weak_reject" ? "major_revision"
              : "reject") as ReviewVerdict,
          };
          mockReviewBufferRef.current = [...mockReviewBufferRef.current, result];
          setMockReviewResult([...mockReviewBufferRef.current]);
        } catch {
          mockReviewBufferRef.current = [
            ...mockReviewBufferRef.current,
            { reviewer: payload.reviewer, content: payload.raw, tags: [], verdict: "major_revision" },
          ];
          setMockReviewResult([...mockReviewBufferRef.current]);
        }
      }
    ).then(u => { unlistenReviewer = u; });

    listen<{ submissionId: string }>("submission:ai_review:done", ({ payload }) => {
      if (payload.submissionId !== activeMockReviewSubmissionRef.current) {
        return;
      }
      setMockReviewLoading(false);
      if (payload.submissionId === checklistSubId) {
        void refreshDiagnosisReports();
      }
    }).then(u => { unlistenDone = u; });

    listen<{ submissionId: string; error: string }>("submission:ai_review:error", ({ payload }) => {
      if (payload.submissionId !== activeMockReviewSubmissionRef.current) {
        return;
      }
      setMockReviewLoading(false);
      showSubmissionError(payload.error);
    }).then(u => { unlistenError = u; });

    return () => {
      unlistenReviewer?.();
      unlistenDone?.();
      unlistenError?.();
    };
  }, [checklistSubId, refreshDiagnosisReports, showSubmissionError]);

  // Cover letter event listeners
  useEffect(() => {
    let unlistenDelta: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;

    listen<{ submissionId: string; delta: string }>("submission:cover_letter:delta", ({ payload }) => {
      setCoverLetterText(prev => prev + payload.delta);
    }).then(u => { unlistenDelta = u; });

    listen<{ submissionId: string; fullText: string }>("submission:cover_letter:done", ({ payload }) => {
      setCoverLetterText(payload.fullText);
      setCoverLetterLoading(false);
    }).then(u => { unlistenDone = u; });

    return () => { unlistenDelta?.(); unlistenDone?.(); };
  }, []);

  // Polish event listeners
  useEffect(() => {
    let unlistenDelta: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;

    listen<{ submissionId: string; delta: string }>("submission:polish:delta", ({ payload }) => {
      if (payload.submissionId === reviewSubId || payload.submissionId === versionSubId) {
        setPolishText(prev => prev + payload.delta);
      }
    }).then(u => { unlistenDelta = u; });

    listen<{ submissionId: string; fullText: string }>("submission:polish:done", ({ payload }) => {
      setPolishText(payload.fullText);
      setPolishLoading(false);
    }).then(u => { unlistenDone = u; });

    return () => { unlistenDelta?.(); unlistenDone?.(); };
  }, [reviewSubId, versionSubId]);

  const handleUploadVersionFile = async (versionId: string) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof selected === "string" && selected) {
        const fileName = selected.split(/[\\/]/).pop() || "paper.pdf";
        await patchVersion(versionId, { filePath: selected, fileName });
      }
    } catch (error) {
      showSubmissionError(error);
    }
  };

  const handleDownloadVersionFile = async (filePath?: string) => {
    if (!filePath) return;
    try {
      const { openLink } = await import("../lib/links");
      await openLink(filePath);
    } catch (error) {
      showSubmissionError(error);
    }
  };

  // ── Version helpers ──
  const versionNextTag = (() => {
    if (versions.length === 0) return "v1.0";
    const last = versions[versions.length - 1].tag;
    const [major, minor] = last.replace("v", "").split(".").map(Number);
    return `v${major}.${(minor ?? 0) + 1}`;
  })();

  const handleSaveVersion = async () => {
    if (!saveForm.label.trim() || !saveForm.content.trim()) return;
    const currentSub = submissions.find(s => s.id === versionSubId);
    const tag = saveForm.tag.trim() || versionNextTag;
    try {
      const res = await submissionApi.createVersion({
        submissionId: versionSubId,
        tag, label: saveForm.label.trim(),
        stage: currentSub?.status ?? "writing",
        content: saveForm.content.trim(),
        notes: saveForm.notes.trim(),
      });
      appendVersion({
        id: res.id, submissionId: versionSubId, tag,
        label: saveForm.label.trim(),
        stage: currentSub?.status ?? "writing",
        content: saveForm.content.trim(),
        notes: saveForm.notes.trim(),
        createdAt: new Date(),
      });
    } catch (error) {
      showSubmissionError(error);
      return;
    }
    setShowSaveModal(false);
    setSaveForm({ tag: "", label: "", notes: "", content: "" });
  };

  const handleOpenSaveVersionModal = () => {
    setSaveForm({
      tag: versionNextTag,
      label: "",
      notes: "",
      content: versions[versions.length - 1]?.content ?? "",
    });
    setShowSaveModal(true);
  };

  const handlePolishVersion = (version: PaperVersion) => {
    if (!version.content.trim()) return;
    setPolishSourceId(version.id);
    setPolishText("");
    setPolishLoading(true);
    setShowPolishPanel(true);
    submissionApi.polishAbstract(version.submissionId, version.content).catch((error) => {
      showSubmissionError(error);
      setPolishLoading(false);
    });
  };

  const handleOpenMockReview = async (version: PaperVersion) => {
    setReviewSubId(version.submissionId);
    setMockReviewResult(null);
    setMockFileName(null);
    setShowMockReviewModal(true);

    if (version.filePath) {
      setMockFileExtracting(true);
      setMockReviewInput((currentInput) => ({ ...currentInput, abstract: "" }));
      try {
        const { extractTextFromPdf } = await import("../lib/pdfExtract");
        const text = await extractTextFromPdf(version.filePath);
        setMockReviewInput((currentInput) => ({ ...currentInput, abstract: text }));
        setMockFileName(version.fileName ?? "paper.pdf");
      } catch {
        setMockReviewInput((currentInput) => ({ ...currentInput, abstract: version.content }));
      } finally {
        setMockFileExtracting(false);
      }
      return;
    }

    setMockReviewInput((currentInput) => ({ ...currentInput, abstract: version.content }));
  };

  const handleOpenAddReviewModal = () => {
    const currentRounds = reviewRounds.filter((round) => round.submissionId === reviewSubId);
    const nextRound = currentRounds.length > 0 ? Math.max(...currentRounds.map((round) => round.round)) + 1 : 1;
    setReviewRound(nextRound);
    setReviewForm({ reviewer: "Reviewer 1", content: "", tags: [], verdict: "major_revision" });
    setShowAddReviewModal(true);
  };

  const handleAddReviewComment = async () => {
    if (!reviewForm.reviewer.trim() || !reviewForm.content.trim()) return;

    try {
      const roundExists = reviewRounds.some((round) => round.submissionId === reviewSubId && round.round === reviewRound);
      if (!roundExists) {
        await submissionApi.upsertRound({
          submissionId: reviewSubId,
          round: reviewRound,
          verdict: reviewForm.verdict,
        });

        setReviewRounds((currentRounds) => [
          ...currentRounds,
          {
            submissionId: reviewSubId,
            round: reviewRound,
            verdict: reviewForm.verdict,
            receivedAt: new Date(),
          },
        ]);
      }

      const response = await submissionApi.createComment({
        submissionId: reviewSubId,
        round: reviewRound,
        reviewer: reviewForm.reviewer.trim(),
        content: reviewForm.content.trim(),
        tags: reviewForm.tags,
      });

      setReviewComments((currentComments) => [
        ...currentComments,
        {
          id: response.id,
          submissionId: reviewSubId,
          round: reviewRound,
          reviewer: reviewForm.reviewer.trim(),
          content: reviewForm.content.trim(),
          response: "",
          resolved: false,
          tags: reviewForm.tags,
          createdAt: new Date(),
        },
      ]);

      const reviewerMatch = reviewForm.reviewer.match(/\d+/);
      const nextReviewerIndex = reviewerMatch ? Number.parseInt(reviewerMatch[0], 10) + 1 : 2;
      setReviewForm((currentForm) => ({
        ...currentForm,
        reviewer: `Reviewer ${nextReviewerIndex}`,
        content: "",
        tags: [],
      }));
    } catch (error) {
      showSubmissionError(error);
    }
  };

  const handleToggleReviewResolved = (commentId: string) => {
    const comment = reviewComments.find((item) => item.id === commentId);
    if (!comment) return;

    setReviewComments((currentComments) =>
      currentComments.map((item) => (item.id === commentId ? { ...item, resolved: !item.resolved } : item))
    );
    submissionApi.updateComment(commentId, { resolved: !comment.resolved }).catch((error) => {
      showSubmissionError(error);
      setReviewComments((currentComments) =>
        currentComments.map((item) => (item.id === commentId ? { ...item, resolved: comment.resolved } : item))
      );
    });
  };

  const handleUpdateReviewResponse = (commentId: string, response: string) => {
    const previousResponse = reviewComments.find((item) => item.id === commentId)?.response ?? "";
    setReviewComments((currentComments) =>
      currentComments.map((item) => (item.id === commentId ? { ...item, response } : item))
    );
    submissionApi.updateComment(commentId, { response }).catch((error) => {
      showSubmissionError(error);
      setReviewComments((currentComments) =>
        currentComments.map((item) => (item.id === commentId ? { ...item, response: previousResponse } : item))
      );
    });
  };

  const handleOpenCoverLetter = () => {
    setCoverLetterText("");
    setCoverLetterLoading(true);
    setShowCoverLetterModal(true);
    submissionApi.generateCoverLetter(reviewSubId).catch((error) => {
      showSubmissionError(error);
      setCoverLetterLoading(false);
    });
  };

  const handlePickMockReviewPdf = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (typeof selected !== "string" || !selected) {
      return;
    }

    setMockFileExtracting(true);
    try {
      const { extractTextFromPdf } = await import("../lib/pdfExtract");
      const text = await extractTextFromPdf(selected);
      setMockReviewInput((currentInput) => ({ ...currentInput, abstract: text }));
      setMockFileName(selected.split("/").pop() ?? "paper.pdf");
    } catch (error) {
      showSubmissionError(error);
    } finally {
      setMockFileExtracting(false);
    }
  };

  const handleResetMockReview = () => {
    mockReviewBufferRef.current = [];
    setMockReviewResult(null);
  };

  const handleGenerateMockReview = () => {
    activeMockReviewSubmissionRef.current = reviewSubId;
    mockReviewBufferRef.current = [];
    setMockReviewLoading(true);
    setMockReviewResult([]);
    submissionApi
      .aiReview({
        submissionId: reviewSubId,
        content: mockReviewInput.abstract,
        reviewerCount: mockReviewInput.reviewerCount,
        strictness: mockReviewInput.strictness,
      })
      .catch((error) => {
        showSubmissionError(error);
        setMockReviewLoading(false);
      });
  };

  const handleImportMockReview = async () => {
    if (!mockReviewResult?.length) return;

    const existingRounds = reviewRounds
      .filter((round) => round.submissionId === reviewSubId)
      .map((round) => round.round);
    const nextRound = existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1;
    const verdict = getDominantVerdict(countVerdicts(mockReviewResult));

    try {
      await submissionApi.upsertRound({ submissionId: reviewSubId, round: nextRound, verdict });

      const createdComments = await Promise.all(
        mockReviewResult.map(async (result) => {
          const response = await submissionApi.createComment({
            submissionId: reviewSubId,
            round: nextRound,
            reviewer: result.reviewer,
            content: result.content,
            tags: result.tags,
          });

          return {
            id: response.id,
            submissionId: reviewSubId,
            round: nextRound,
            reviewer: result.reviewer,
            content: result.content,
            response: "",
            resolved: false,
            tags: result.tags,
            createdAt: new Date(),
          };
        })
      );

      setReviewRounds((currentRounds) => [
        ...currentRounds,
        { submissionId: reviewSubId, round: nextRound, verdict, receivedAt: new Date() },
      ]);
      setReviewComments((currentComments) => [...currentComments, ...createdComments]);
      setReviewRound(nextRound);
      setShowMockReviewModal(false);
    } catch (error) {
      showSubmissionError(error);
    }
  };

  const handleApplyPolishResult = () => {
    if (!polishText || !polishSourceId) return;
    patchVersion(polishSourceId, { content: polishText })
      .then(() => setShowPolishPanel(false))
      .catch(showSubmissionError);
  };

  // ── Stats ──
  const activeCount = submissions.filter(s => ["writing", "submitted", "reviewing"].includes(s.status)).length;
  const acceptedCount = submissions.filter(s => s.status === "accepted").length;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <SubmissionPageHeader
        activeTab={tab}
        conferencesCount={conferences.length}
        journalsCount={journals.length}
        activeCount={activeCount}
        acceptedCount={acceptedCount}
        onTabChange={setTab}
      />

      <SubmissionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback("")} />

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "conferences" && (
          <>
            <VenueTrackerWorkspace
              venueFilter={venueFilter}
              visibleVenues={visibleVenues}
              conferencesCount={conferences.length}
              journalsCount={journals.length}
              recommendations={recommendations}
              recommendationLoading={recLoading}
              recommendationInput={recInput}
              onVenueFilterChange={setVenueFilter}
              onOpenAddVenue={() => setShowAddModal(true)}
              onChangeRecommendationInput={setRecInput}
              onGenerateRecommendations={generateRecommendations}
              isVenueAdded={isVenueAdded}
              onAddVenue={handleAddVenue}
              onCreateSubmissionFromRecommendation={(recommendation) => {
                setAddSubForm({
                  title: recInput.title.trim(),
                  venue: recommendation.name,
                  venueType: recommendation.type,
                  deadline: "",
                });
                setShowAddSubModal(true);
              }}
              onToggleVenueStar={toggleVenueStar}
              onSyncDdl={async () => {
                setSyncingDdl(true);
                setDdlSyncResult("");
                try {
                  // 优先使用内置数据，失败时尝试 GitHub
                  let result;
                  try {
                    result = await submissionApi.syncCcfDdlLocal();
                  } catch {
                    result = await submissionApi.syncCcfDdl();
                  }
                  setDdlSyncResult(`已同步 ${result.fetched} 个会议，更新 ${result.updated} 条记录`);
                } catch (err) {
                  setDdlSyncResult(formatErrorMessage(err));
                } finally {
                  setSyncingDdl(false);
                }
              }}
              syncingDdl={syncingDdl}
            />
            {ddlSyncResult ? (
              <p className="mt-2 text-xs text-ink-tertiary">{ddlSyncResult}</p>
            ) : null}
          </>
        )}

        {tab === "kanban" && (
          <KanbanWorkspace
            submissions={submissions}
            rejectionRecoveryPlans={rejectionRecoveryPlans}
            onOpenAddSubmission={() => setShowAddSubModal(true)}
            onMoveSubmission={moveSubmission}
            onPrepareTransfer={(plan, target) => {
              setAddSubForm({
                title: plan.submission.title,
                venue: target.name,
                venueType: target.type,
                deadline: "",
              });
              setShowAddSubModal(true);
            }}
          />
        )}

        {tab === "checklist" && (
          <ChecklistWorkspace
            submissions={submissions}
            checklistSubId={checklistSubId}
            checklist={checklist}
            checklistCat={checklistCat}
            categories={categories}
            visibleCategories={visibleCategories}
            filteredChecklist={filteredChecklist}
            diagnosisReports={diagnosisReports}
            diagnosisLoading={diagnosisLoading}
            importingDiagnosisReportId={importingDiagnosisReportId}
            revisionTasks={revisionTasks}
            revisionVersions={revisionVersions}
            revisionExperiments={revisionExperiments}
            revisionLoading={revisionLoading}
            importingRevisionTaskReportId={importingRevisionTaskReportId}
            updatingRevisionTaskId={updatingRevisionTaskId}
            checkedCount={checkedCount}
            progress={progress}
            onSelectSubmission={setChecklistSubId}
            onReset={resetChecklist}
            onSelectCategory={setChecklistCat}
            onToggleCheck={toggleCheck}
            onImportDiagnosisReport={importReportToChecklist}
            onImportDiagnosisTasks={importReportToTasks}
            onUpdateRevisionTask={updateRevisionTask}
          />
        )}

        {tab === "versions" && (
          <VersionWorkspace
            submissions={submissions}
            versions={versions}
            versionCounts={versionCounts}
            versionSubId={versionSubId}
            compareIds={compareIds}
            onSelectSubmission={(submissionId) => {
              setVersionSubId(submissionId);
              setCompareIds(null);
            }}
            onSetCompareIds={setCompareIds}
            onOpenSaveModal={handleOpenSaveVersionModal}
            onUploadVersionFile={handleUploadVersionFile}
            onDownloadVersionFile={handleDownloadVersionFile}
            onPolishVersion={handlePolishVersion}
            onOpenMockReview={handleOpenMockReview}
          />
        )}

        {tab === "reviews" && (
          <ReviewWorkspace
            submissions={submissions}
            reviewComments={reviewComments}
            reviewRounds={reviewRounds}
            reviewSubId={reviewSubId}
            reviewRound={reviewRound}
            onSelectSubmission={(submissionId) => {
              setReviewSubId(submissionId);
              setReviewRound(1);
            }}
            onSelectRound={setReviewRound}
            onOpenCoverLetter={handleOpenCoverLetter}
            onOpenAddReview={handleOpenAddReviewModal}
            onToggleResolved={handleToggleReviewResolved}
            onUpdateResponse={handleUpdateReviewResponse}
          />
        )}
      </div>

      <MockReviewModal
        open={showMockReviewModal}
        mockReviewInput={mockReviewInput}
        mockReviewResult={mockReviewResult}
        mockReviewLoading={mockReviewLoading}
        mockFileExtracting={mockFileExtracting}
        mockFileName={mockFileName}
        onClose={() => setShowMockReviewModal(false)}
        onSetInput={setMockReviewInput}
        onPickPdf={handlePickMockReviewPdf}
        onReset={handleResetMockReview}
        onImport={handleImportMockReview}
        onGenerate={handleGenerateMockReview}
      />

      <ReviewEntryModal
        open={showAddReviewModal}
        currentVenue={submissions.find((submission) => submission.id === reviewSubId)?.venue}
        reviewRound={reviewRound}
        reviewRounds={reviewRounds}
        reviewSubId={reviewSubId}
        reviewForm={reviewForm}
        onClose={() => setShowAddReviewModal(false)}
        onSetReviewForm={setReviewForm}
        onSubmit={handleAddReviewComment}
      />

      <AddSubmissionModal
        open={showAddSubModal}
        form={addSubForm}
        onClose={() => setShowAddSubModal(false)}
        onSetForm={setAddSubForm}
        onSubmit={handleAddSubmission}
      />

      <SaveVersionModal
        open={showSaveModal}
        versionNextTag={versionNextTag}
        form={saveForm}
        onClose={() => setShowSaveModal(false)}
        onSetForm={setSaveForm}
        onSubmit={handleSaveVersion}
      />

      <AddVenueModal
        open={showAddModal}
        search={addModalSearch}
        areaFilter={addModalAreaFilter}
        typeFilter={addModalTypeFilter}
        areas={areas}
        filteredVenueTemplates={filteredVenueTemplates}
        loading={venueTemplateLoading}
        trackedCount={conferences.length + journals.length}
        onClose={() => setShowAddModal(false)}
        onSearchChange={setAddModalSearch}
        onAreaFilterChange={setAddModalAreaFilter}
        onTypeFilterChange={setAddModalTypeFilter}
        isVenueAdded={isVenueAdded}
        onAddVenue={handleAddVenue}
      />

      <CoverLetterModal
        open={showCoverLetterModal}
        text={coverLetterText}
        loading={coverLetterLoading}
        onClose={() => setShowCoverLetterModal(false)}
        onChangeText={setCoverLetterText}
      />

      <PolishPanel
        open={showPolishPanel}
        text={polishText}
        loading={polishLoading}
        onClose={() => setShowPolishPanel(false)}
        onChangeText={setPolishText}
        onApply={handleApplyPolishResult}
      />
    </div>
  );
}
