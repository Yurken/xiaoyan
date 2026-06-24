import { useState, useEffect } from "react";
import { submissionApi } from "../../lib/client";
import {
  rowToComment,
  rowToRound,
  type MockReviewInput,
  type MockReviewerResult,
  type ReviewComment,
  type ReviewFormState,
  type ReviewRound,
  type ReviewVerdict,
} from "./shared";

export type { MockReviewInput, MockReviewerResult, ReviewFormState };

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

  const reloadReview = () => {
    if (!subId) {
      setRounds([]);
      setComments([]);
      return;
    }
    Promise.all([
      submissionApi.listRounds(subId),
      submissionApi.listComments(subId),
    ]).then(([roundsRes, commentsRes]) => {
      setRounds(roundsRes.rounds.map(rowToRound));
      setComments(commentsRes.comments.map(rowToComment));
    }).catch(onError);
  };

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
      await submissionApi.upsertRound({
        submissionId: subId, round, verdict: form.verdict,
      });
      await submissionApi.createComment({
        submissionId: subId, round,
        reviewer: form.reviewer, content: form.content, tags: form.tags,
      });
      setShowAddModal(false);
      setForm({ reviewer: "", content: "", tags: [], verdict: "major_revision" });
      reloadReview();
    } catch (err) {
      onError(err);
    }
  };

  const toggleResolved = async (commentId: string) => {
    const target = comments.find((comment) => comment.id === commentId);
    if (!target) return;
    const nextResolved = !target.resolved;
    setComments((current) =>
      current.map((comment) => (comment.id === commentId ? { ...comment, resolved: nextResolved } : comment)),
    );
    try {
      await submissionApi.updateComment(commentId, { resolved: nextResolved });
    } catch (err) {
      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? { ...comment, resolved: target.resolved } : comment)),
      );
      onError(err);
    }
  };

  const updateResponse = (commentId: string, response: string) => {
    setComments((current) =>
      current.map((comment) => (comment.id === commentId ? { ...comment, response } : comment)),
    );
    submissionApi.updateComment(commentId, { response }).catch(onError);
  };

  return {
    comments, rounds, subId, setSubId, round, setRound,
    showAddModal, setShowAddModal,
    form, setForm, handleReviewSubmit,
    toggleResolved, updateResponse, reloadReview,
    showMockModal, setShowMockModal,
    mockInput, setMockInput, mockLoading, setMockLoading,
    mockResult, setMockResult,
    mockFileExtracting, setMockFileExtracting,
    mockFileName, setMockFileName,
  };
}
