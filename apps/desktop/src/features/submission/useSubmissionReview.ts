import { useState, useEffect, useCallback } from "react";
import { submissionApi } from "../../lib/client";
import { formatErrorMessage } from "../../lib/client";
import type { ReviewComment, ReviewRound, ReviewVerdict } from "./shared";

export interface ReviewFormState {
  reviewer: string;
  content: string;
  tags: string[];
  verdict: ReviewVerdict;
}

export interface MockReviewInput {
  abstract: string;
  reviewerCount: number;
  strictness: string;
}

export interface MockReviewerResult {
  reviewer: string;
  content: string;
  tags: string[];
  verdict: ReviewVerdict;
}

function rowToRound(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    submissionId: String(row.submission_id || ""),
    roundNumber: Number(row.round_number ?? 1),
    createdAt: String(row.created_at || ""),
    summary: String(row.summary ?? ""),
  } as ReviewRound;
}

function rowToComment(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    submissionId: String(row.submission_id || ""),
    roundNumber: Number(row.round_number ?? 1),
    reviewer: String(row.reviewer ?? ""),
    content: String(row.content ?? ""),
    tags: (row.tags as string[]) ?? [],
    verdict: (row.verdict as ReviewVerdict) ?? "major_revision",
    createdAt: String(row.created_at || ""),
  } as ReviewComment;
}

export function useSubmissionReview(onError: (error: unknown) => void) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [rounds, setRounds] = useState<ReviewRound[]>([]);
  const [subId, setSubId] = useState<string>("");
  const [round, setRound] = useState<number>(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<ReviewFormState>({
    reviewer: "", content: "", tags: [] as string[], verdict: "major_revision" as ReviewVerdict,
  });

  // AI review state
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockInput, setMockInput] = useState<MockReviewInput>({
    abstract: "", reviewerCount: 3, strictness: "balanced",
  });
  const [mockLoading, setMockLoading] = useState(false);
  const [mockResult, setMockResult] = useState<MockReviewerResult[] | null>(null);
  const [mockFileExtracting, setMockFileExtracting] = useState(false);
  const [mockFileName, setMockFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!subId) return;
    Promise.all([
      submissionApi.listRounds(subId),
      submissionApi.listComments(subId),
    ]).then(([roundsRes, commentsRes]) => {
      setRounds(roundsRes.rounds.map(rowToRound));
      setComments(commentsRes.comments.map(rowToComment));
    }).catch(onError);
  }, [subId, onError]);

  const handleReviewSubmit = async () => {
    if (!subId) return;
    try {
      await submissionApi.addComment({
        submissionId: subId, roundNumber: round,
        reviewer: form.reviewer, content: form.content,
        tags: form.tags, verdict: form.verdict,
      });
      setShowAddModal(false);
      setForm({ reviewer: "", content: "", tags: [], verdict: "major_revision" });
    } catch (err) {
      onError(err);
    }
  };

  return {
    comments, rounds, subId, setSubId, round, setRound,
    showAddModal, setShowAddModal,
    form, setForm, handleReviewSubmit,
    showMockModal, setShowMockModal,
    mockInput, setMockInput, mockLoading, setMockLoading,
    mockResult, setMockResult,
    mockFileExtracting, setMockFileExtracting,
    mockFileName, setMockFileName,
  };
}
