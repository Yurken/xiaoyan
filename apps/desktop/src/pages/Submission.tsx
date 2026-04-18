import { useState, useEffect, useRef } from "react";
import { submissionApi } from "../lib/client";
import { listen } from "@tauri-apps/api/event";
import {
  Calendar,
  CheckSquare,
  GitBranch,
  History,
  KanbanSquare,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  POPULAR_VENUES,
  getAllAreas,
  type VenueTemplate,
} from "../data/venues";
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
import { useSubmissionVersions } from "../features/submission/useSubmissionVersions";
import VenueTrackerWorkspace from "../features/submission/VenueTrackerWorkspace";
import VersionWorkspace from "../features/submission/VersionWorkspace";
import {
  DEFAULT_CHECKLIST,
  KANBAN_COLS,
  countVerdicts,
  getDaysUntil,
  getDominantVerdict,
  rowToComment,
  rowToRound,
  rowToSubmission,
  rowToVenue,
  type AddSubmissionFormState,
  type ChecklistItem,
  type Conference,
  type Journal,
  type MockReviewInput,
  type MockReviewerResult,
  type PaperVersion,
  type ReviewComment,
  type ReviewFormState,
  type ReviewRound,
  type ReviewVerdict,
  type SaveVersionFormState,
  type Submission,
  type Venue,
  type VenueRecommendation,
  type VenueType,
} from "../features/submission/shared";

export default function Submission() {
  const [tab, setTab] = useState<"conferences" | "kanban" | "checklist" | "versions" | "reviews">("conferences");

  // Venue state (会议 + 期刊)
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [venueFilter, setVenueFilter] = useState<"all" | "conference" | "journal" | "starred">("all");

  // Add venue modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalSearch, setAddModalSearch] = useState("");
  const [addModalAreaFilter, setAddModalAreaFilter] = useState<string>("all");
  const [addModalTypeFilter, setAddModalTypeFilter] = useState<"all" | "conference" | "journal">("all");

  // Kanban state
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [checklistCat, setChecklistCat] = useState<string>("all");

  // Add submission modal state
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [addSubForm, setAddSubForm] = useState<AddSubmissionFormState>({
    title: "",
    venue: "",
    venueType: "conference",
    deadline: "",
  });

  // Version control state
  const [versionSubId, setVersionSubId] = useState<string>("");
  const { versions, versionCounts, appendVersion, updateVersion } = useSubmissionVersions(submissions, versionSubId);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveVersionFormState>({ tag: "", label: "", notes: "", content: "" });

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

  // ── DB data loading ──
  useEffect(() => {
    submissionApi.listVenues().then(res => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const venues = (res.venues as any[]).map(rowToVenue);
      setConferences(venues.filter(v => v.type === "conference") as Conference[]);
      setJournals(venues.filter(v => v.type === "journal") as Journal[]);
    }).catch(console.error);

    submissionApi.list().then(res => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subs = (res.submissions as any[]).map(rowToSubmission);
      setSubmissions(subs);
      if (subs.length > 0 && !versionSubId) setVersionSubId(subs[0].id);
      if (subs.length > 0 && !reviewSubId) setReviewSubId(subs[0].id);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload rounds + comments when selected review submission changes
  useEffect(() => {
    if (!reviewSubId) return;
    Promise.all([
      submissionApi.listRounds(reviewSubId),
      submissionApi.listComments(reviewSubId),
    ]).then(([roundsRes, commentsRes]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setReviewRounds((roundsRes.rounds as any[]).map(rowToRound));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setReviewComments((commentsRes.comments as any[]).map(rowToComment));
    }).catch(console.error);
  }, [reviewSubId]);

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
    }).then(u => { unlistenDone = u; });

    listen<{ submissionId: string; error: string }>("submission:ai_review:error", ({ payload }) => {
      if (payload.submissionId !== activeMockReviewSubmissionRef.current) {
        return;
      }
      setMockReviewLoading(false);
      console.error("AI review error:", payload.error);
    }).then(u => { unlistenError = u; });

    return () => {
      unlistenReviewer?.();
      unlistenDone?.();
      unlistenError?.();
    };
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewSubId, versionSubId]);

  const handleUploadVersionFile = async (versionId: string) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof selected === "string" && selected) {
        const fileName = selected.split("/").pop() || "paper.pdf";
        updateVersion(versionId, (version) => ({ ...version, filePath: selected, fileName }));
      }
    } catch (error) {
      console.error("Upload file failed:", error);
    }
  };

  const handleDownloadVersionFile = async (filePath?: string) => {
    if (!filePath) return;
    try {
      const { openLink } = await import("../lib/links");
      await openLink(filePath);
    } catch (error) {
      console.error("Download file failed:", error);
    }
  };

  // ── Venue helpers ──
  const allVenues: Venue[] = [...conferences, ...journals];

  const visibleVenues = allVenues
    .filter(v => {
      if (venueFilter === "starred") return v.starred;
      if (venueFilter === "conference") return v.type === "conference";
      if (venueFilter === "journal") return v.type === "journal";
      return true;
    })
    .sort((a, b) => {
      // 会议按截止日期排序，期刊按特刊截止日期或名称排序
      const dA = a.type === "conference"
        ? getDaysUntil(a.deadline)
        : a.specialIssueDeadline ? getDaysUntil(a.specialIssueDeadline) : 999;
      const dB = b.type === "conference"
        ? getDaysUntil(b.deadline)
        : b.specialIssueDeadline ? getDaysUntil(b.specialIssueDeadline) : 999;
      if (dA < 0 && dB >= 0) return 1;
      if (dB < 0 && dA >= 0) return -1;
      return dA - dB;
    });

  const toggleVenueStar = (id: string, type: VenueType) => {
    if (type === "conference") {
      setConferences(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));
    } else {
      setJournals(prev => prev.map(j => j.id === id ? { ...j, starred: !j.starred } : j));
    }
    submissionApi.toggleVenueStar(id).catch(console.error);
  };

  // ── Add venue helpers ──
  const handleAddVenue = async (template: VenueTemplate) => {
    const defaultConferenceDeadline =
      template.type === "conference"
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        : null;

    try {
      const res = await submissionApi.createVenue({
        name: template.name, fullName: template.fullName,
        venueType: template.type, website: template.website,
        ccf: template.ccf, area: template.area,
        ei: template.ei, sci: (template as Journal).sci,
        sciQuartile: (template as Journal).sciQuartile,
        deadline: defaultConferenceDeadline?.toISOString().slice(0, 10),
      });
      const newId = res.id;
      if (template.type === "conference") {
        setConferences(prev => [...prev, {
          id: newId, type: "conference",
          name: template.name, fullName: template.fullName,
          website: template.website,
          deadline: defaultConferenceDeadline ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          ccf: template.ccf, area: template.area, starred: false, ei: template.ei,
        }]);
      } else {
        setJournals(prev => [...prev, {
          id: newId, type: "journal",
          name: template.name, fullName: template.fullName,
          website: template.website,
          ccf: template.ccf, area: template.area, starred: false,
          sci: (template as Journal).sci,
          sciQuartile: (template as Journal).sciQuartile,
          ei: template.ei,
        }]);
      }
    } catch (e) { console.error(e); }
    setShowAddModal(false);
  };

  const isVenueAdded = (template: VenueTemplate) => {
    if (template.type === "conference") {
      return conferences.some(c => c.name === template.name);
    }
    return journals.some(j => j.name === template.name);
  };

  const filteredVenueTemplates = POPULAR_VENUES.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(addModalSearch.toLowerCase()) ||
      v.fullName.toLowerCase().includes(addModalSearch.toLowerCase());
    const matchesArea = addModalAreaFilter === "all" || v.area === addModalAreaFilter;
    const matchesType = addModalTypeFilter === "all" || v.type === addModalTypeFilter;
    return matchesSearch && matchesArea && matchesType;
  });

  const areas = getAllAreas();

  // ── Kanban helpers ──
  const moveSubmission = (id: string, direction: "prev" | "next") => {
    setSubmissions(prev => prev.map(s => {
      if (s.id !== id) return s;
      const idx = KANBAN_COLS.findIndex(c => c.key === s.status);
      const nextIdx = direction === "next" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= KANBAN_COLS.length) return s;
      const newStatus = KANBAN_COLS[nextIdx].key;
      const newSubmittedAt = direction === "next" && s.status === "writing" ? new Date() : s.submittedAt;
      submissionApi.update(id, {
        status: newStatus,
        submittedAt: newSubmittedAt?.toISOString().slice(0, 10),
      }).catch(console.error);
      return { ...s, status: newStatus, submittedAt: newSubmittedAt };
    }));
  };

  // ── Add submission helper ──
  const handleAddSubmission = async () => {
    if (!addSubForm.title.trim() || !addSubForm.venue.trim()) return;
    try {
      const res = await submissionApi.create({
        title: addSubForm.title.trim(),
        venueName: addSubForm.venue.trim(),
        venueType: addSubForm.venueType,
        status: "writing",
        deadline: addSubForm.deadline || undefined,
      });
      const newSub: Submission = {
        id: res.id,
        title: addSubForm.title.trim(),
        venue: addSubForm.venue.trim(),
        venueType: addSubForm.venueType,
        status: "writing",
        deadline: addSubForm.deadline ? new Date(addSubForm.deadline) : undefined,
      };
      setSubmissions(prev => [...prev, newSub]);
      if (!versionSubId) setVersionSubId(res.id);
      if (!reviewSubId) setReviewSubId(res.id);
    } catch (e) { console.error(e); }
    setShowAddSubModal(false);
    setAddSubForm({ title: "", venue: "", venueType: "conference", deadline: "" });
  };

  // ── Checklist helpers ──
  const toggleCheck = (id: string) =>
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));

  const checkedCount = checklist.filter(i => i.checked).length;
  const progress = Math.round((checkedCount / checklist.length) * 100);
  const categories = ["all", ...Array.from(new Set(checklist.map(i => i.category)))];
  const filteredChecklist = checklistCat === "all" ? checklist : checklist.filter(i => i.category === checklistCat);
  const visibleCategories = checklistCat === "all"
    ? Array.from(new Set(checklist.map(i => i.category)))
    : [checklistCat];

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
    } catch (e) { console.error(e); }
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
      console.error(error);
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

    const roundExists = reviewRounds.some((round) => round.submissionId === reviewSubId && round.round === reviewRound);
    if (!roundExists) {
      await submissionApi
        .upsertRound({
          submissionId: reviewSubId,
          round: reviewRound,
          verdict: reviewForm.verdict,
        })
        .catch(console.error);

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

    try {
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
    } catch (error) {
      console.error(error);
    }

    const reviewerMatch = reviewForm.reviewer.match(/\d+/);
    const nextReviewerIndex = reviewerMatch ? Number.parseInt(reviewerMatch[0], 10) + 1 : 2;
    setReviewForm((currentForm) => ({
      ...currentForm,
      reviewer: `Reviewer ${nextReviewerIndex}`,
      content: "",
      tags: [],
    }));
  };

  const handleToggleReviewResolved = (commentId: string) => {
    const comment = reviewComments.find((item) => item.id === commentId);
    if (!comment) return;

    submissionApi.updateComment(commentId, { resolved: !comment.resolved }).catch(console.error);
    setReviewComments((currentComments) =>
      currentComments.map((item) => (item.id === commentId ? { ...item, resolved: !item.resolved } : item))
    );
  };

  const handleUpdateReviewResponse = (commentId: string, response: string) => {
    submissionApi.updateComment(commentId, { response }).catch(console.error);
    setReviewComments((currentComments) =>
      currentComments.map((item) => (item.id === commentId ? { ...item, response } : item))
    );
  };

  const handleOpenCoverLetter = () => {
    setCoverLetterText("");
    setCoverLetterLoading(true);
    setShowCoverLetterModal(true);
    submissionApi.generateCoverLetter(reviewSubId).catch((error) => {
      console.error(error);
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
    } catch {
      // Keep current abstract text when extraction fails.
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
        console.error(error);
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

    await submissionApi
      .upsertRound({ submissionId: reviewSubId, round: nextRound, verdict })
      .catch(console.error);

    const createdComments = await Promise.all(
      mockReviewResult.map(async (result, index) => {
        const response = await submissionApi
          .createComment({
            submissionId: reviewSubId,
            round: nextRound,
            reviewer: result.reviewer,
            content: result.content,
            tags: result.tags,
          })
          .catch(() => ({ id: `mock-${Date.now()}-${index}` }));

        return {
          id: (response as { id: string }).id,
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
  };

  const handleApplyPolishResult = () => {
    if (!polishText || !polishSourceId) return;
    updateVersion(polishSourceId, (version) => ({ ...version, content: polishText }));
    setShowPolishPanel(false);
  };

  // ── Recommendation state + logic ──
  const [showRecPanel, setShowRecPanel] = useState(false);
  const [recInput, setRecInput] = useState({
    direction: submissions.map(s => s.venue).join("、"),
    keywords: "natural language processing, machine learning, graph neural network",
    extra: "",
  });
  const [recommendations, setRecommendations] = useState<VenueRecommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const generateRecommendations = () => {
    setRecLoading(true);
    setTimeout(() => {
      const terms = [recInput.direction, recInput.keywords, recInput.extra]
        .join(" ").toLowerCase()
        .split(/[\s,，、;；]+/)
        .map(t => t.trim())
        .filter(t => t.length > 2);

      const trackedNames = new Set([
        ...conferences.map(c => c.name.split(" ")[0].toLowerCase()),
        ...journals.map(j => j.name.toLowerCase()),
      ]);

      const REASON_TEMPLATES: Record<string, string> = {
        "人工智能": "该顶级 AI 会议与您的研究方向高度匹配，是您研究领域的核心发表平台。",
        "数据库": "与您在数据检索与挖掘方向的研究契合，引用影响力强。",
        "计算机网络": "网络与系统领域旗舰会议，适合您在分布式相关方向的工作。",
        "网络与信息安全": "安全顶会，适合涉及对抗鲁棒性或隐私相关研究。",
        "软件工程": "程序分析与软件系统领域权威发表场所。",
      };

      const results: VenueRecommendation[] = POPULAR_VENUES
        .filter(v => !trackedNames.has(v.name.split(" ")[0].toLowerCase()))
        .map(v => {
          const haystack = `${v.name} ${v.fullName} ${v.area}`.toLowerCase();
          const hits = terms.filter(t => haystack.includes(t));
          const ccfBonus = v.ccf === "A" ? 35 : v.ccf === "B" ? 20 : v.ccf === "C" ? 8 : 0;
          const sciBonus = v.sci ? 15 : 0;
          const score = Math.min(98, hits.length * 18 + ccfBonus + sciBonus + Math.floor(Math.random() * 6));
          const reason = REASON_TEMPLATES[v.area]
            ?? (v.ccf === "A"
              ? `CCF A 类${v.type === "conference" ? "会议" : "期刊"}，与您在 ${v.area} 领域的研究方向吻合，录用率较高且学术影响力强。`
              : `该${v.type === "conference" ? "会议" : "期刊"}聚焦 ${v.area}，与您的关键词「${hits.slice(0, 2).join("、") || v.area}」高度相关，投稿竞争相对适中。`);
          return { ...v, reason, matchScore: score, matchTags: hits.slice(0, 4) };
        })
        .filter(v => v.matchScore >= 30)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      setRecommendations(results);
      setRecLoading(false);
    }, 900);
  };

  // ── Stats ──
  const activeCount = submissions.filter(s => ["writing", "submitted", "reviewing"].includes(s.status)).length;
  const acceptedCount = submissions.filter(s => s.status === "accepted").length;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 pt-5 pb-4"
        style={{ borderBottom: "1px solid var(--rc-border)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">投稿管理</h1>
            <p className="mt-1 text-sm text-ink-tertiary">追踪会议期刊DDL，管理论文投稿全流程。</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "追踪会议",   value: conferences.length, color: "#007AFF" },
              { label: "追踪期刊",   value: journals.length,   color: "#AF52DE" },
              { label: "进行中",     value: activeCount,       color: "#FF9500" },
              { label: "已接收",     value: acceptedCount,     color: "#34C759" },
            ].map(stat => (
              <div
                key={stat.label}
                className="text-center px-4 py-2 rounded-2xl"
                style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.10), inset -1px -1px 4px rgba(255,255,255,0.55)" }}
              >
                <p className="text-[11px] text-ink-tertiary">{stat.label}</p>
                <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {[
            { key: "conferences" as const, icon: Calendar,     label: "DDL 日历" },
            { key: "kanban"      as const, icon: KanbanSquare, label: "投稿看板" },
            { key: "checklist"   as const, icon: CheckSquare,  label: "提交清单" },
            { key: "versions"    as const, icon: GitBranch,    label: "版本控制" },
            { key: "reviews"     as const, icon: History,      label: "审稿归档" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all duration-150 border-b-2"
              style={tab === key ? {
                color: "#007AFF",
                borderBottomColor: "#007AFF",
                background: "var(--rc-card-bg)",
              } : {
                color: "var(--rc-text-tertiary)" as string,
                borderBottomColor: "transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ════════ DDL 日历 ════════ */}
        {tab === "conferences" && (
          <VenueTrackerWorkspace
            venueFilter={venueFilter}
            visibleVenues={visibleVenues}
            conferencesCount={conferences.length}
            journalsCount={journals.length}
            showRecommendations={showRecPanel}
            recommendations={recommendations}
            recommendationLoading={recLoading}
            recommendationInput={recInput}
            onVenueFilterChange={setVenueFilter}
            onOpenAddVenue={() => setShowAddModal(true)}
            onToggleRecommendations={() => setShowRecPanel((prev) => !prev)}
            onChangeRecommendationInput={setRecInput}
            onGenerateRecommendations={generateRecommendations}
            isVenueAdded={isVenueAdded}
            onAddVenue={handleAddVenue}
            onToggleVenueStar={toggleVenueStar}
          />
        )}

        {/* ════════ 投稿看板 ════════ */}
        {tab === "kanban" && (
          <KanbanWorkspace
            submissions={submissions}
            onOpenAddSubmission={() => setShowAddSubModal(true)}
            onMoveSubmission={moveSubmission}
          />
        )}

        {/* ════════ 提交清单 ════════ */}
        {tab === "checklist" && (
          <ChecklistWorkspace
            checklist={checklist}
            checklistCat={checklistCat}
            categories={categories}
            visibleCategories={visibleCategories}
            filteredChecklist={filteredChecklist}
            checkedCount={checkedCount}
            progress={progress}
            onReset={() => setChecklist((prev) => prev.map((item) => ({ ...item, checked: false })))}
            onSelectCategory={setChecklistCat}
            onToggleCheck={toggleCheck}
          />
        )}

        {/* ════════ 版本控制 ════════ */}
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

        {/* ════════ 审稿归档 ════════ */}
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
