import { useEffect, useRef } from "react";
import { canStartDsh, type DshRuntimeSnapshot } from "./shared";

export function useDshAutoStart({ snapshot, loading, busy, start }: {
  snapshot: DshRuntimeSnapshot | null;
  loading: boolean;
  busy: boolean;
  start: () => Promise<unknown>;
}) {
  const attempted = useRef(false);
  useEffect(() => {
    if (loading || !snapshot) return;
    if (snapshot.phase !== "stopped") attempted.current = true;
    if (busy || attempted.current || !canStartDsh(snapshot)) return;
    attempted.current = true;
    void start();
  }, [busy, loading, snapshot, start]);
}
