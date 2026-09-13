import { useCallback, useEffect, useRef, useState } from "react";
import { safeListen } from "../../lib/tauriEvent";
import { apiClient, submissionApi } from "../../lib/client";
import { rowToWorkbenchCheckpoint } from "./shared";
import { buildHomeModel, EMPTY_HOME, type HomeModel } from "./home/shared";

export function useWorkbenchOverview() {
  const [model, setModel] = useState<HomeModel>(EMPTY_HOME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    const [papers, interests, notes, sessions, checkpoints, submission] = await Promise.allSettled([
      apiClient.papers.list(0, 100),
      apiClient.knowledge.listInterests(),
      apiClient.knowledge.listNotes(),
      apiClient.chat.listSessions(),
      apiClient.memory.listCheckpoints(8),
      submissionApi.stats(),
    ]);
    if (request !== generation.current) return;
    const failed = [papers, interests, notes, sessions, checkpoints, submission].some((result) => result.status === "rejected");
    setModel(buildHomeModel({
      papers: papers.status === "fulfilled" ? papers.value : [],
      interests: interests.status === "fulfilled" ? interests.value : [],
      notes: notes.status === "fulfilled" ? notes.value : [],
      sessions: sessions.status === "fulfilled" ? sessions.value : [],
      checkpoints: checkpoints.status === "fulfilled" ? checkpoints.value.checkpoints.map(rowToWorkbenchCheckpoint) : [],
      submission: submission.status === "fulfilled" ? submission.value : { active: 0, pendingReviews: 0, upcomingDdls: [] },
    }));
    setError(failed ? "部分近期记录暂时无法读取，你仍可直接开始工作。" : "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const cleanups: Array<() => void> = [];
    let mounted = true;
    for (const event of ["interest:plan", "interest:status", "knowledge:note_created"]) {
      void safeListen(event, () => { void refresh(); }).then((cleanup) => {
        if (mounted) cleanups.push(cleanup);
        else cleanup();
      });
    }
    return () => {
      mounted = false;
      generation.current += 1;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [refresh]);

  return { model, loading, error, refresh };
}
