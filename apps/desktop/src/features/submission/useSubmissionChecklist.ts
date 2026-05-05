import { useEffect, useMemo, useState } from "react";
import { submissionApi } from "../../lib/client";
import {
  DEFAULT_CHECKLIST,
  rowToChecklistItem,
  type ChecklistItem,
  type Submission,
} from "./shared";

export function useSubmissionChecklist(submissions: Submission[]) {
  const [checklistSubId, setChecklistSubId] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [checklistCat, setChecklistCat] = useState<string>("all");

  useEffect(() => {
    if (checklistSubId || submissions.length === 0) {
      return;
    }

    setChecklistSubId(submissions[0].id);
  }, [checklistSubId, submissions]);

  useEffect(() => {
    if (!checklistSubId) {
      setChecklist(DEFAULT_CHECKLIST);
      return;
    }

    let cancelled = false;
    submissionApi
      .getChecklist(checklistSubId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const items = response.checklist.map(rowToChecklistItem);
        setChecklist(items.length > 0 ? items : DEFAULT_CHECKLIST);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setChecklist(DEFAULT_CHECKLIST);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checklistSubId]);

  useEffect(() => {
    setChecklistCat("all");
  }, [checklistSubId]);

  const toggleCheck = (id: string) => {
    const item = checklist.find((entry) => entry.id === id);
    if (!item) {
      return;
    }

    setChecklist((currentChecklist) =>
      currentChecklist.map((entry) => (entry.id === id ? { ...entry, checked: !entry.checked } : entry))
    );

    if (checklistSubId) {
      submissionApi.toggleChecklist(id).catch((error) => {
        console.error(error);
        setChecklist((currentChecklist) =>
          currentChecklist.map((entry) => (entry.id === id ? { ...entry, checked: item.checked } : entry))
        );
      });
    }
  };

  const resetChecklist = () => {
    const checkedItems = checklist.filter((item) => item.checked);
    setChecklist((currentChecklist) => currentChecklist.map((item) => ({ ...item, checked: false })));

    if (!checklistSubId || checkedItems.length === 0) {
      return;
    }

    Promise.all(checkedItems.map((item) => submissionApi.toggleChecklist(item.id))).catch((error) => {
      console.error(error);
      setChecklist((currentChecklist) =>
        currentChecklist.map((item) =>
          checkedItems.some((checkedItem) => checkedItem.id === item.id)
            ? { ...item, checked: true }
            : item
        )
      );
    });
  };

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(checklist.map((item) => item.category)))],
    [checklist]
  );
  const filteredChecklist = useMemo(
    () => (checklistCat === "all" ? checklist : checklist.filter((item) => item.category === checklistCat)),
    [checklist, checklistCat]
  );
  const visibleCategories = useMemo(
    () =>
      checklistCat === "all"
        ? Array.from(new Set(checklist.map((item) => item.category)))
        : [checklistCat],
    [checklist, checklistCat]
  );
  const checkedCount = checklist.filter((item) => item.checked).length;
  const progress = checklist.length > 0 ? Math.round((checkedCount / checklist.length) * 100) : 0;

  return {
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
  };
}
