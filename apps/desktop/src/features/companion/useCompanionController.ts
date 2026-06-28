import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import { safeListen } from "../../lib/tauriEvent";
import {
  chatAgentAction,
  interestAgentAction,
  resolveWorkAction,
  surveyAgentAction,
  WORK_PRIORITY,
  type CompanionActionKey,
  type WorkItem,
} from "./shared";

const IDLE_TO_SLEEP_MS = 3 * 60 * 1000;
const CLICK_WINDOW = 400;
const DRAG_THRESHOLD = 4;

interface CompanionControllerOptions {
  allowIdleSleep?: boolean;
}

function clearTimer(timer: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (timer.current) {
    clearTimeout(timer.current);
    timer.current = null;
  }
}

export function useCompanionController({ allowIdleSleep = true }: CompanionControllerOptions = {}) {
  const [visible, setVisible] = useState(false);
  const [shownAction, setShownAction] = useState<CompanionActionKey>("idle");
  const [opacity, setOpacity] = useState(1);
  const [pos, setPos] = useState({ right: 16, bottom: 16 });
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const currentShown = useRef<CompanionActionKey>("idle");
  const isReacting = useRef(false);
  const isSleeping = useRef(false);
  const isStreaming = useRef(false);
  const activeWork = useRef<Map<string, WorkItem>>(new Map());

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSleepRunId = useRef(0);
  const oneshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);
  const firstClickDir = useRef<"left" | "right" | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, right: 16, bottom: 16 });
  const containerRef = useRef<HTMLDivElement>(null);

  const showAction = useCallback((key: CompanionActionKey) => {
    if (currentShown.current === key) return;
    currentShown.current = key;
    clearTimer(actionSwitchTimer);
    setOpacity(0);
    actionSwitchTimer.current = setTimeout(() => {
      actionSwitchTimer.current = null;
      setShownAction(key);
      setOpacity(1);
    }, 180);
  }, []);

  const resumeWork = useCallback(() => {
    isReacting.current = false;
    const workAction = resolveWorkAction(activeWork.current);
    if (workAction) {
      showAction(workAction);
    } else if (isStreaming.current) {
      showAction("working");
    } else {
      isSleeping.current = false;
      showAction("idle");
    }
  }, [showAction]);

  const cancelIdleTimer = useCallback(() => {
    clearTimer(idleTimer);
    idleSleepRunId.current += 1;
    isSleeping.current = false;
  }, []);

  const startIdleTimer = useCallback(() => {
    clearTimer(idleTimer);
    idleSleepRunId.current += 1;
    if (!allowIdleSleep) {
      isSleeping.current = false;
      return;
    }
    const runId = idleSleepRunId.current;
    idleTimer.current = setTimeout(() => {
      if (!allowIdleSleep || activeWork.current.size > 0 || isStreaming.current) return;
      isSleeping.current = true;
      const steps: [CompanionActionKey, number][] = [
        ["looking", 3500],
        ["yawning", 4500],
        ["dozing", 6500],
        ["resting", 4200],
        ["collapsing", 4500],
        ["sleeping", 0],
      ];
      let delay = 0;
      for (const [key, duration] of steps) {
        setTimeout(() => {
          if (isSleeping.current && idleSleepRunId.current === runId) showAction(key);
        }, delay);
        delay += duration;
      }
    }, IDLE_TO_SLEEP_MS);
  }, [allowIdleSleep, showAction]);

  const wakeIfSleeping = useCallback(() => {
    if (!isSleeping.current) return false;
    cancelIdleTimer();
    showAction("waking");
    setTimeout(() => resumeWork(), 2000);
    return true;
  }, [cancelIdleTimer, resumeWork, showAction]);

  const playReaction = useCallback((key: CompanionActionKey, ms: number) => {
    clearTimer(reactionTimer);
    isReacting.current = true;
    showAction(key);
    reactionTimer.current = setTimeout(() => {
      reactionTimer.current = null;
      resumeWork();
    }, ms);
  }, [resumeWork, showAction]);

  const triggerFeedback = useCallback((key: CompanionActionKey, ms: number, afterCb?: () => void) => {
    clearTimer(oneshotTimer);
    isReacting.current = false;
    showAction(key);
    oneshotTimer.current = setTimeout(() => {
      oneshotTimer.current = null;
      afterCb?.();
      resumeWork();
    }, ms);
  }, [resumeWork, showAction]);

  useEffect(() => {
    if (allowIdleSleep) return;
    cancelIdleTimer();
    if (activeWork.current.size === 0 && !isStreaming.current && !isReacting.current) {
      showAction("idle");
    }
  }, [allowIdleSleep, cancelIdleTimer, showAction]);

  const startWork = useCallback((id: string, actionKey: CompanionActionKey) => {
    cancelIdleTimer();
    wakeIfSleeping();
    activeWork.current.set(id, { actionKey, priority: WORK_PRIORITY[actionKey] ?? 2 });
    const next = resolveWorkAction(activeWork.current);
    if (next && !isReacting.current) showAction(next);
  }, [cancelIdleTimer, showAction, wakeIfSleeping]);

  const finishWork = useCallback((id: string, success = true) => {
    activeWork.current.delete(id);
    const next = resolveWorkAction(activeWork.current);
    if (next) {
      if (!isReacting.current) showAction(next);
    } else if (isStreaming.current) {
      if (!isReacting.current) showAction("working");
    } else if (success) {
      triggerFeedback("celebrating", 4000, () => startIdleTimer());
    } else {
      triggerFeedback("alerting", 5000, () => startIdleTimer());
    }
  }, [showAction, startIdleTimer, triggerFeedback]);

  useEffect(() => {
    const unlisten: Array<() => void> = [];
    let cancelled = false;
    (async () => {
      unlisten.push(await safeListen<{ request_id: string; value: { id: string; agent_name: string } }>(
        "chat:agent_start",
        ({ payload }) => startWork(payload.value.id, chatAgentAction(payload.value.agent_name)),
      ));

      unlisten.push(await safeListen<{ request_id: string; value: { id: string; status: string } }>(
        "chat:agent_complete",
        ({ payload }) => finishWork(payload.value.id, payload.value.status !== "failed"),
      ));

      unlisten.push(await safeListen("chat:delta", () => {
        if (!isStreaming.current) {
          isStreaming.current = true;
          cancelIdleTimer();
          wakeIfSleeping();
          if (activeWork.current.size === 0 && !isReacting.current) showAction("working");
        }
      }));

      unlisten.push(await safeListen("chat:done", () => {
        isStreaming.current = false;
        for (const id of activeWork.current.keys()) {
          if (!id.startsWith("paper_") && !id.startsWith("survey_") && !id.startsWith("interest_")) {
            activeWork.current.delete(id);
          }
        }
        if (activeWork.current.size === 0) {
          triggerFeedback("celebrating", 4000, () => startIdleTimer());
        }
      }));

      unlisten.push(await safeListen("chat:error", () => {
        isStreaming.current = false;
        for (const id of activeWork.current.keys()) {
          if (!id.startsWith("paper_") && !id.startsWith("survey_") && !id.startsWith("interest_")) {
            activeWork.current.delete(id);
          }
        }
        if (activeWork.current.size === 0) {
          triggerFeedback("alerting", 5000, () => startIdleTimer());
        }
      }));

      unlisten.push(await safeListen("chat:plan", () => {
        cancelIdleTimer();
        wakeIfSleeping();
        if (activeWork.current.size === 0 && !isReacting.current) showAction("planning");
      }));

      unlisten.push(await safeListen<{ request_id: string; agent: { id: string; name: string } }>(
        "survey:agent_start",
        ({ payload }) => startWork(`survey_${payload.agent.id}`, surveyAgentAction(payload.agent.name)),
      ));

      unlisten.push(await safeListen<{ request_id: string; agent: { id: string } }>(
        "survey:agent_complete",
        ({ payload }) => finishWork(`survey_${payload.agent.id}`),
      ));

      unlisten.push(await safeListen("survey:done", () => {
        activeWork.current = new Map([...activeWork.current.entries()].filter(([id]) => !id.startsWith("survey_")));
        if (activeWork.current.size === 0) triggerFeedback("celebrating", 4000, () => startIdleTimer());
      }));

      unlisten.push(await safeListen("survey:error", () => {
        activeWork.current = new Map([...activeWork.current.entries()].filter(([id]) => !id.startsWith("survey_")));
        if (activeWork.current.size === 0) triggerFeedback("alerting", 5000, () => startIdleTimer());
      }));

      // 小妍主动扫描论文通知
      unlisten.push(await safeListen<{ count: number; unread: number }>(
        "active-researcher:scan-complete",
        ({ payload }) => {
          if (payload.unread > 0) {
            setNotificationCount(payload.unread);
            cancelIdleTimer();
            wakeIfSleeping();
            showAction("notification");
          }
        },
      ));

      unlisten.push(await safeListen<{ paper_id: string; status: string }>("paper:status", ({ payload }) => {
        const workId = `paper_${payload.paper_id}`;
        if (payload.status === "parsing" || payload.status === "metadata") {
          startWork(workId, "reading");
        } else if (payload.status === "analyzing") {
          activeWork.current.set(workId, { actionKey: "debugger", priority: WORK_PRIORITY.debugger });
          const next = resolveWorkAction(activeWork.current);
          if (next && !isReacting.current) showAction(next);
        } else if (payload.status === "analyzed" || payload.status === "reproduced") {
          finishWork(workId, true);
        } else if (payload.status === "error" || payload.status === "failed") {
          finishWork(workId, false);
        }
      }));

      unlisten.push(await safeListen<{ id: string; agent: { id: string; name: string } }>(
        "interest:agent_start",
        ({ payload }) => startWork(`interest_${payload.agent.id}`, interestAgentAction(payload.agent.name)),
      ));

      unlisten.push(await safeListen<{ id: string; agent: { id: string } }>(
        "interest:agent_complete",
        ({ payload }) => finishWork(`interest_${payload.agent.id}`),
      ));

      unlisten.push(await safeListen("interest:error", () => {
        activeWork.current = new Map([...activeWork.current.entries()].filter(([id]) => !id.startsWith("interest_")));
        if (activeWork.current.size === 0) triggerFeedback("alerting", 5000, () => startIdleTimer());
      }));

      // 卸载若发生在异步注册完成之前，cleanup 的 forEach 只清到部分监听；
      // 这里在注册全部完成后补清一次（safeListen 的 unlisten 幂等，重复调用安全）。
      if (cancelled) unlisten.forEach((fn) => fn());
    })();

    startIdleTimer();
    const visibleTimer = setTimeout(() => setVisible(true), 200);
    return () => {
      cancelled = true;
      clearTimeout(visibleTimer);
      unlisten.forEach((fn) => fn());
      [idleTimer, oneshotTimer, reactionTimer, clickTimer, actionSwitchTimer].forEach(clearTimer);
    };
  }, [cancelIdleTimer, finishWork, showAction, startIdleTimer, startWork, triggerFeedback, wakeIfSleeping]);

  const handleActivate = useCallback((clientX?: number, containerWidth?: number) => {
    // 小妍有论文通知 — 点击打开通知面板
    if (notificationCount > 0) {
      setNotificationOpen((prev) => !prev);
      return;
    }
    if (wakeIfSleeping()) return;
    const isWorking = activeWork.current.size > 0 || isStreaming.current;
    if (isWorking) {
      playReaction("alerting", 2000);
      return;
    }
    if (isReacting.current) return;

    const dir: "left" | "right" = (
      typeof clientX === "number"
      && typeof containerWidth === "number"
      && clientX < containerWidth / 2
    )
      ? "left"
      : "right";
    clickCount.current += 1;
    if (clickCount.current === 1) firstClickDir.current = dir;
    clearTimer(clickTimer);

    if (clickCount.current >= 4) {
      clickCount.current = 0;
      firstClickDir.current = null;
      playReaction(Math.random() < 0.5 ? "celebrating" : "react_jump", 3500);
      return;
    }

    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      const count = clickCount.current;
      const firstDir = firstClickDir.current;
      clickCount.current = 0;
      firstClickDir.current = null;
      if (count >= 2 && Math.random() < 0.5) {
        playReaction("peeking", 3000);
      } else {
        playReaction(firstDir === "left" ? "react_left" : "react_right", 2500);
      }
    }, CLICK_WINDOW);
  }, [notificationCount, playReaction, wakeIfSleeping]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    isDragging.current = false;
    dragStart.current = { x: event.clientX, y: event.clientY, right: pos.right, bottom: pos.bottom };
  }, [pos]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    if (!isDragging.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      isDragging.current = true;
      clearTimer(reactionTimer);
      isReacting.current = true;
      showAction("react_drag");
    }
    if (isDragging.current) {
      setPos({
        right: Math.max(0, dragStart.current.right - dx),
        bottom: Math.max(0, dragStart.current.bottom - dy),
      });
    }
  }, [showAction]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const wasDrag = isDragging.current;
    isDragging.current = false;
    if (wasDrag) {
      reactionTimer.current = setTimeout(() => {
        reactionTimer.current = null;
        resumeWork();
      }, 500);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      handleActivate(event.clientX - rect.left, event.currentTarget.offsetWidth);
    }
  }, [handleActivate, resumeWork]);

  return {
    visible,
    shownAction,
    opacity,
    pos,
    notificationCount,
    notificationOpen,
    containerRef,
    isDragging,
    setNotificationCount,
    setNotificationOpen,
    activate: handleActivate,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
