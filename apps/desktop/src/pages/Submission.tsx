import { useState, useEffect, useRef } from "react";
import { submissionApi } from "../lib/client";
import { listen } from "@tauri-apps/api/event";
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  FilePlus,
  GitBranch,
  History,
  KanbanSquare,
  Plus,
  Sparkles,
  Star,
  StarOff,
  Trophy,
  Users,
} from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import { open } from "@tauri-apps/plugin-dialog";
import {
  POPULAR_VENUES,
  getAllAreas,
  type VenueTemplate,
} from "../data/venues";
import AddSubmissionModal from "../features/submission/AddSubmissionModal";
import AddVenueModal from "../features/submission/AddVenueModal";
import CoverLetterModal from "../features/submission/CoverLetterModal";
import ExternalLink from "../components/ExternalLink";
import MockReviewModal from "../features/submission/MockReviewModal";
import PolishPanel from "../features/submission/PolishPanel";
import ReviewEntryModal from "../features/submission/ReviewEntryModal";
import ReviewWorkspace from "../features/submission/ReviewWorkspace";
import SaveVersionModal from "../features/submission/SaveVersionModal";
import VersionWorkspace from "../features/submission/VersionWorkspace";
import {
  CCF_STYLE,
  DEFAULT_CHECKLIST,
  KANBAN_COLS,
  STATUS_CFG,
  countVerdicts,
  getDaysUntil,
  getDominantVerdict,
  getDdlStyle,
  rowToComment,
  rowToRound,
  rowToSubmission,
  rowToVenue,
  rowToVersion,
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
  const [versions, setVersions] = useState<PaperVersion[]>([]);
  const [versionSubId, setVersionSubId] = useState<string>("");
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

  // Reload versions when selected submission changes
  useEffect(() => {
    if (!versionSubId) return;
    submissionApi.listVersions(versionSubId).then(res => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVersions((res.versions as any[]).map(rowToVersion));
    }).catch(console.error);
  }, [versionSubId]);

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
        setVersions(prev =>
          prev.map(v =>
            v.id === versionId
              ? { ...v, filePath: selected, fileName }
              : v
          )
        );
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
    const vList = versions.filter(v => v.submissionId === versionSubId);
    if (vList.length === 0) return "v1.0";
    const last = vList[vList.length - 1].tag;
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
      setVersions(prev => [...prev, {
        id: res.id, submissionId: versionSubId, tag,
        label: saveForm.label.trim(),
        stage: currentSub?.status ?? "writing",
        content: saveForm.content.trim(),
        notes: saveForm.notes.trim(),
        createdAt: new Date(),
      }]);
    } catch (e) { console.error(e); }
    setShowSaveModal(false);
    setSaveForm({ tag: "", label: "", notes: "", content: "" });
  };

  const handleOpenSaveVersionModal = () => {
    const currentVersions = versions.filter((version) => version.submissionId === versionSubId);
    setSaveForm({
      tag: versionNextTag,
      label: "",
      notes: "",
      content: currentVersions[currentVersions.length - 1]?.content ?? "",
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
    setVersions((currentVersions) =>
      currentVersions.map((version) => (version.id === polishSourceId ? { ...version, content: polishText } : version))
    );
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
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 pt-5 pb-0"
        style={{ borderBottom: "1px solid var(--rc-border)" }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">投稿管理</h1>
            <p className="mt-0.5 text-sm text-ink-tertiary">追踪会议期刊DDL，管理论文投稿全流程。</p>
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(["all", "conference", "journal", "starred"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setVenueFilter(f)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                    style={venueFilter === f
                      ? { background: "#007AFF", color: "#fff" }
                      : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                    }
                  >
                    {f === "all" ? "全部" : f === "conference" ? "会议" : f === "journal" ? "期刊" : "⭐ 已关注"}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowAddModal(true)}>
                <Plus className="w-3.5 h-3.5" />
                添加会议/期刊
              </Button>
            </div>

            {/* ── 智能推荐面板 ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--rc-border)", background: "var(--rc-card-bg)" }}
            >
              {/* 折叠 header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-black/[0.02]"
                onClick={() => setShowRecPanel(p => !p)}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "#AF52DE" }} />
                  <span className="text-sm font-semibold text-ink-primary">智能推荐刊会</span>
                  {recommendations.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(175,82,222,0.12)", color: "#AF52DE" }}>
                      {recommendations.length} 个推荐
                    </span>
                  )}
                  <span className="text-xs text-ink-tertiary">根据研究方向与投稿历史自动匹配</span>
                </div>
                {showRecPanel
                  ? <ChevronUp className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                }
              </button>

              {showRecPanel && (
                <>
                  {/* 输入区 */}
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <p className="text-xs font-medium text-ink-secondary mb-1">研究方向 / 论文主题</p>
                        <textarea
                          rows={3}
                          placeholder="告诉小妍你的研究方向或论文主题…"
                          value={recInput.direction}
                          onChange={e => setRecInput(p => ({ ...p, direction: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-xs resize-none leading-relaxed"
                          style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-ink-secondary mb-1">关键词</p>
                          <input
                            type="text"
                            placeholder="如：LLM, diffusion, reinforcement learning…"
                            value={recInput.keywords}
                            onChange={e => setRecInput(p => ({ ...p, keywords: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs"
                            style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-ink-secondary mb-1">补充说明（可选）</p>
                          <input
                            type="text"
                            placeholder="如：偏理论 / 工程落地 / 希望 CCF A 类…"
                            value={recInput.extra}
                            onChange={e => setRecInput(p => ({ ...p, extra: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs"
                            style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-ink-tertiary">基于投稿历史 · 关键词匹配 · CCF/SCI 评级综合评分</p>
                      <button
                        onClick={generateRecommendations}
                        disabled={recLoading}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg, #AF52DE, #007AFF)", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
                      >
                        {recLoading
                          ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />分析中…</>
                          : <><Sparkles className="w-3 h-3" />生成推荐</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* 推荐结果 */}
                  {recommendations.length > 0 && (
                    <div className="p-3 space-y-2 border-t" style={{ borderColor: "var(--rc-border)" }}>
                      <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">推荐结果</p>
                      {recommendations.map(rec => {
                        const ccfS = CCF_STYLE[rec.ccf];
                        const already = isVenueAdded(rec);
                        return (
                          <div
                            key={rec.id}
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ background: "var(--rc-card-inset-bg)" }}
                          >
                            {/* Score ring */}
                            <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-10">
                              <span className="text-base font-bold tabular-nums" style={{
                                color: rec.matchScore >= 80 ? "#34C759" : rec.matchScore >= 55 ? "#007AFF" : "#FF9500"
                              }}>
                                {rec.matchScore}
                              </span>
                              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--rc-border)" }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${rec.matchScore}%`,
                                  background: rec.matchScore >= 80 ? "#34C759" : rec.matchScore >= 55 ? "#007AFF" : "#FF9500"
                                }} />
                              </div>
                              <span className="text-[9px] text-ink-tertiary">匹配度</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-ink-primary">{rec.name}</span>
                                {rec.ccf !== "none" && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: ccfS.bg, color: ccfS.color }}>CCF {rec.ccf}</span>
                                )}
                                {rec.sci && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: "rgba(52,199,89,0.12)", color: "#1A7F37" }}>SCI</span>
                                )}
                                {rec.sciQuartile && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: "rgba(88,86,214,0.12)", color: "#5856D6" }}>{rec.sciQuartile}</span>
                                )}
                                {rec.ei && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}>EI</span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                                  style={{ background: "rgba(142,142,147,0.10)", color: "#8E8E93" }}>
                                  {rec.type === "conference" ? "会议" : "期刊"}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-tertiary mt-0.5 truncate">{rec.fullName}</p>
                              <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{rec.reason}</p>
                              {rec.matchTags.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {rec.matchTags.map(t => (
                                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md"
                                      style={{ background: "rgba(175,82,222,0.10)", color: "#AF52DE" }}>
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action */}
                            <button
                              onClick={() => !already && handleAddVenue(rec)}
                              disabled={already}
                              className="flex-shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all duration-150 disabled:opacity-40"
                              style={already
                                ? { background: "rgba(52,199,89,0.12)", color: "#34C759" }
                                : { background: "#007AFF", color: "#fff", boxShadow: "1px 2px 6px rgba(0,122,255,0.25)" }
                              }
                            >
                              {already ? "已追踪 ✓" : "+ 追踪"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-2.5">
              {visibleVenues.map(venue => {
                const isConf = venue.type === "conference";
                const days = isConf
                  ? getDaysUntil(venue.deadline)
                  : venue.specialIssueDeadline ? getDaysUntil(venue.specialIssueDeadline) : null;
                const ddl = days !== null ? getDdlStyle(days) : null;
                const ccf = CCF_STYLE[venue.ccf];
                return (
                  <Card key={venue.id} padding="sm" className="group">
                    <div className="flex items-center gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {venue.website ? (
                            <ExternalLink
                              href={venue.website}
                              className="font-semibold text-base text-ink-primary truncate hover:text-blue-600 hover:underline"
                            >
                              {venue.name}
                            </ExternalLink>
                          ) : (
                            <p className="font-semibold text-base text-ink-primary truncate">{venue.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {/* CCF tag */}
                          {venue.ccf !== "none" && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: ccf.bg, color: ccf.color }}
                            >
                              CCF {venue.ccf}
                            </span>
                          )}
                          {/* SCI */}
                          {!isConf && (venue as Journal).sci && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: "rgba(52,199,89,0.12)", color: "#1A7F37" }}>
                              SCI
                            </span>
                          )}
                          {/* JCR quartile */}
                          {!isConf && (venue as Journal).sciQuartile && (() => {
                            const q = (venue as Journal).sciQuartile!;
                            const qColor = q === "Q1" ? { bg: "rgba(88,86,214,0.12)", color: "#5856D6" }
                              : q === "Q2" ? { bg: "rgba(0,122,255,0.12)", color: "#007AFF" }
                              : q === "Q3" ? { bg: "rgba(255,149,0,0.12)", color: "#E65100" }
                              : { bg: "rgba(142,142,147,0.12)", color: "#6B6B6B" };
                            return (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                style={{ background: qColor.bg, color: qColor.color }}>
                                {q}
                              </span>
                            );
                          })()}
                          {/* EI */}
                          {venue.ei && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}>
                              EI
                            </span>
                          )}
                          {/* Type badge */}
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{
                              background: isConf ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                              color: isConf ? "#007AFF" : "#AF52DE",
                            }}
                          >
                            {isConf ? "会议" : "期刊"}
                          </span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: "rgba(142,142,147,0.10)", color: "#8E8E93" }}
                          >
                            {venue.area}
                          </span>
                        </div>
                        <p className="text-xs text-ink-tertiary mt-0.5 truncate">{venue.fullName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {isConf ? (
                            <>
                              <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                                <Clock className="w-3 h-3" />
                                截止 {venue.deadline.toLocaleDateString("zh-CN")}
                              </span>
                              {venue.notificationDate && (
                                <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                                  <Bell className="w-3 h-3" />
                                  通知 {venue.notificationDate.toLocaleDateString("zh-CN")}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                                <BookOpen className="w-3 h-3" />
                                随时投稿
                              </span>
                              {venue.specialIssueDeadline && venue.specialIssueTitle && (
                                <span className="flex items-center gap-1 text-[11px]" style={{ color: "#FF9500" }}>
                                  <Bell className="w-3 h-3" />
                                  特刊「{venue.specialIssueTitle}」截止 {venue.specialIssueDeadline.toLocaleDateString("zh-CN")}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* DDL countdown (会议和特刊) */}
                      {ddl && (
                        <div
                          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
                          style={{ background: ddl.bg, color: ddl.color }}
                        >
                          {days! < 0 ? "已截止" : `还剩 ${ddl.label}`}
                        </div>
                      )}

                      {/* Star */}
                      <button
                        onClick={() => toggleVenueStar(venue.id, venue.type)}
                        className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150 hover:bg-black/5 opacity-0 group-hover:opacity-100"
                      >
                        {venue.starred
                          ? <Star className="w-4 h-4 fill-current" style={{ color: "#FF9500" }} />
                          : <StarOff className="w-4 h-4 text-ink-tertiary" />
                        }
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Collaboration placeholder */}
            <div
              className="rounded-3xl p-4 flex items-center gap-3 border-2 border-dashed opacity-50"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Users className="w-5 h-5 text-ink-tertiary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink-secondary">课题组共享日历（即将上线）</p>
                <p className="text-xs text-ink-tertiary mt-0.5">邀请课题组成员，共同追踪会议与期刊，统一管理投稿节奏。</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 投稿看板 ════════ */}
        {tab === "kanban" && (
          <div className="space-y-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-tertiary">点击「推进 →」更新论文投稿进度</p>
              <Button variant="secondary" size="sm" onClick={() => setShowAddSubModal(true)}>
                <FilePlus className="w-3.5 h-3.5" />
                新增投稿
              </Button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {KANBAN_COLS.map(({ key, label }, colIdx) => {
                const cfg = STATUS_CFG[key];
                const items = submissions.filter(s => s.status === key);
                return (
                  <div key={key} className="flex-shrink-0 w-52">
                    {/* Column header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-sm font-semibold text-ink-primary">{label}</span>
                      </div>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {items.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2.5 min-h-[120px]">
                      {items.map(sub => (
                        <div
                          key={sub.id}
                          className="rounded-2xl p-3.5 transition-all duration-150 hover:-translate-y-px cursor-default"
                          style={{ background: "var(--rc-card-bg)", boxShadow: "2px 2px 8px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.7)" }}
                        >
                          <p className="text-sm font-medium text-ink-primary leading-snug line-clamp-3">{sub.title}</p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                              style={{
                                background: sub.venueType === "conference" ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                                color: sub.venueType === "conference" ? "#007AFF" : "#AF52DE",
                              }}
                            >
                              {sub.venueType === "conference" ? "会议" : "期刊"}
                            </span>
                            <p className="text-[11px] text-ink-tertiary truncate">{sub.venue}</p>
                          </div>
                          {sub.deadline && key === "writing" && sub.venueType === "conference" && (
                            <p className="mt-1 text-[11px]" style={{ color: getDdlStyle(getDaysUntil(sub.deadline)).color }}>
                              DDL 还剩 {getDaysUntil(sub.deadline)} 天
                            </p>
                          )}
                          {sub.submittedAt && (
                            <p className="mt-1 text-[11px] text-ink-tertiary">
                              投稿于 {sub.submittedAt.toLocaleDateString("zh-CN")}
                            </p>
                          )}
                          {key === "accepted" && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Trophy className="w-3 h-3" style={{ color: "#34C759" }} />
                                <span className="text-[11px] font-medium" style={{ color: "#34C759" }}>已录用</span>
                              </div>
                              <button
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors"
                                style={{ background: "rgba(52,199,89,0.12)", color: "#34C759" }}
                                onClick={() => {
                                  const year = new Date().getFullYear();
                                  const vType = sub.venueType === "journal" ? "@article" : "@inproceedings";
                                  const vKey = sub.venueType === "journal" ? "journal" : "booktitle";
                                  const key_ = `Author${year}${sub.venue.split(" ")[0]}`;
                                  const bib = `${vType}{${key_},\n  title={${sub.title}},\n  author={},\n  ${vKey}={${sub.venue}},\n  year={${year}}\n}`;
                                  navigator.clipboard.writeText(bib);
                                }}
                                title="复制 BibTeX"
                              >
                                BibTeX
                              </button>
                            </div>
                          )}
                          {/* Move buttons */}
                          <div className="mt-2.5 flex gap-1">
                            {colIdx > 0 && (
                              <button
                                className="text-[10px] text-ink-tertiary hover:text-ink-secondary px-1.5 py-0.5 rounded-md hover:bg-black/5 transition-colors"
                                onClick={() => moveSubmission(sub.id, "prev")}
                              >
                                ← 回退
                              </button>
                            )}
                            {key !== "accepted" && key !== "rejected" && (
                              <button
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md hover:bg-black/5 transition-colors"
                                style={{ color: "#007AFF" }}
                                onClick={() => moveSubmission(sub.id, "next")}
                              >
                                推进 →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {items.length === 0 && (
                        <div
                          className="rounded-2xl p-5 flex items-center justify-center border-2 border-dashed opacity-30"
                          style={{ borderColor: "var(--rc-border)" }}
                        >
                          <p className="text-xs text-ink-tertiary">暂无</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collaboration placeholder */}
            <div
              className="rounded-3xl p-4 flex items-center gap-3 border-2 border-dashed opacity-50"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Users className="w-5 h-5 text-ink-tertiary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink-secondary">多人协作（即将上线）</p>
                <p className="text-xs text-ink-tertiary mt-0.5">邀请共同作者加入投稿项目，分配章节任务、标注评论、共享看板进度。</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 提交清单 ════════ */}
        {tab === "checklist" && (
          <div className="space-y-5">
            {/* Progress header */}
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-ink-primary">提交前检查</p>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: progress === 100 ? "#34C759" : "#007AFF" }}
                  >
                    {checkedCount} / {checklist.length}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.12)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                      background: progress === 100
                        ? "#34C759"
                        : "linear-gradient(90deg, #007AFF, #5856D6)",
                    }}
                  />
                </div>
              </div>
              {progress === 100 && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(52,199,89,0.10)" }}
                >
                  <CheckCircle2 className="w-4 h-4" style={{ color: "#34C759" }} />
                  <span className="text-xs font-medium" style={{ color: "#34C759" }}>可以投稿了</span>
                </div>
              )}
              <button
                className="text-xs text-ink-tertiary hover:text-ink-secondary transition-colors px-3 py-1.5 rounded-lg hover:bg-black/5"
                onClick={() => setChecklist(prev => prev.map(i => ({ ...i, checked: false })))}
              >
                重置
              </button>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(cat => {
                const catCount = checklist.filter(i => i.category === cat).length;
                const catChecked = checklist.filter(i => i.category === cat && i.checked).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setChecklistCat(cat)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                    style={checklistCat === cat
                      ? { background: "#007AFF", color: "#fff" }
                      : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                    }
                  >
                    {cat === "all" ? "全部" : cat}
                    {cat !== "all" && (
                      <span className={checklistCat === cat ? "opacity-70" : "opacity-50"}>
                        {catChecked}/{catCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Items in grid layout */}
            <div className="grid grid-cols-2 gap-3">
              {visibleCategories.map(cat => (
                <div key={cat} className="space-y-2">
                  <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">
                    {cat}
                  </p>
                  <Card padding="sm" className="space-y-1">
                    {filteredChecklist
                      .filter(i => i.category === cat)
                      .map(item => (
                        <button
                          key={item.id}
                          onClick={() => toggleCheck(item.id)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all duration-150 hover:bg-black/[0.03]"
                        >
                          {item.checked
                            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#34C759" }} />
                            : <Circle className="w-4 h-4 flex-shrink-0 text-ink-tertiary" />
                          }
                          <span
                            className="text-[13px] leading-snug transition-all duration-150"
                            style={{
                              color: item.checked ? "#34C759" : "var(--rc-text-primary)" as string,
                              textDecoration: item.checked ? "line-through" : "none",
                              opacity: item.checked ? 0.6 : 1,
                            }}
                          >
                            {item.label}
                          </span>
                        </button>
                      ))}
                  </Card>
                </div>
              ))}
            </div>

            {/* Collaboration placeholder */}
            <div
              className="rounded-2xl p-3.5 flex items-center gap-3 border-2 border-dashed opacity-50"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Users className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink-secondary">团队协作清单（即将上线）</p>
                <p className="text-xs text-ink-tertiary mt-0.5">为每位共同作者分配清单项，追踪各自完成进度。</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 版本控制 ════════ */}
        {tab === "versions" && (
          <VersionWorkspace
            submissions={submissions}
            versions={versions}
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
