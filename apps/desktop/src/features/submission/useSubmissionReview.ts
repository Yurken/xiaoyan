import { useState, useCallback, useEffect, useRef } from "react";
import { submissionApi } from "../../lib/client";
import {
  rowToComment,
  rowToRound,
  type ReviewComment,
  type ReviewFormState,
  type ReviewRound,
  type ReviewVerdict,
} from "./shared";

export type { ReviewFormState };

export function useSubmissionReview(onError: (error: unknown) => void) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [rounds, setRounds] = useState<ReviewRound[]>([]);
  const [subId, setSubId] = useState<string>("");
  const [round, setRound] = useState<number>(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<ReviewFormState>({
    reviewer: "", content: "", tags: [] as string[], verdict: "major_revision" as ReviewVerdict,
  });

  const reloadRequestRef = useRef(0);

  const reloadReview = useCallback(() => {
    const requestId = reloadRequestRef.current + 1;
    reloadRequestRef.current = requestId;
    if (!subId) {
      setRounds([]);
      setComments([]);
      return Promise.resolve();
    }

    return Promise.all([
      submissionApi.listRounds(subId),
      submissionApi.listComments(subId),
    ]).then(([roundsRes, commentsRes]) => {
      if (reloadRequestRef.current !== requestId) return;
      setRounds(roundsRes.rounds.map(rowToRound));
      setComments(commentsRes.comments.map(rowToComment));
    }).catch((error) => {
      if (reloadRequestRef.current === requestId) onError(error);
    });
  }, [onError, subId]);

  useEffect(() => {
    void reloadReview();
  }, [reloadReview]);

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
      void reloadReview();
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
  };
}
