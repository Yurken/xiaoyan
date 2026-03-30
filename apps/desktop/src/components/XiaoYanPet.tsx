/**
 * XiaoYanPet — 小妍桌面伴侣
 *
 * 常驻右下角，根据各工作流 Tauri 事件展示专属动画状态。
 * SVG 动画文件来自 clawd-on-desk 项目（MIT License）。
 *
 * 工作流 → 动画映射：
 *   chat planner          → building    (建造规划图)
 *   chat retrieval        → sweeping    (清扫文献库)
 *   chat literature_scout → carrying    (搬运文献)
 *   chat survey           → typing      (打字撰写)
 *   chat paper_analyst    → debugger    (分析调试)
 *   chat reproduction     → wizard      (法师编程)
 *   chat synthesis        → ultrathink  (深度综合)
 *   2 并发 agents         → juggling
 *   3+ 并发 agents        → conducting
 *   survey 检索规划       → building
 *   survey 文献检索       → sweeping
 *   survey 时序分析       → debugger
 *   survey 综述写作       → typing
 *   paper parsing/meta    → carrying
 *   paper analyzing       → debugger
 *   interest 路径规划     → building
 *   interest 文献筛选     → carrying
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

// ── SVG 路径 ─────────────────────────────────────────────────────────────────

const SVG: Record<string, string> = {
  // 状态
  idle:         "/xiaoyan/clawd-idle-follow.svg",
  yawning:      "/xiaoyan/clawd-idle-yawn.svg",
  dozing:       "/xiaoyan/clawd-idle-doze.svg",
  collapsing:   "/xiaoyan/clawd-collapse-sleep.svg",
  sleeping:     "/xiaoyan/clawd-sleeping.svg",
  waking:       "/xiaoyan/clawd-wake.svg",
  // 工作流专属
  thinking:     "/xiaoyan/clawd-working-thinking.svg",   // 默认思考
  working:      "/xiaoyan/clawd-working-typing.svg",     // 打字/写作
  building:     "/xiaoyan/clawd-working-building.svg",   // 规划/建造
  sweeping:     "/xiaoyan/clawd-working-sweeping.svg",   // 检索/清扫
  carrying:     "/xiaoyan/clawd-working-carrying.svg",   // 文献搬运
  debugger:     "/xiaoyan/clawd-working-debugger.svg",   // 分析/调试
  wizard:       "/xiaoyan/clawd-working-wizard.svg",     // 代码复现
  ultrathink:   "/xiaoyan/clawd-working-ultrathink.svg", // 综合总结
  juggling:     "/xiaoyan/clawd-working-juggling.svg",   // 双 agent 并发
  conducting:   "/xiaoyan/clawd-working-conducting.svg", // 多 agent 指挥
  // 反馈
  attention:    "/xiaoyan/clawd-happy.svg",
  error:        "/xiaoyan/clawd-error.svg",
  notification: "/xiaoyan/clawd-notification.svg",
  // 交互反应
  react_left:   "/xiaoyan/clawd-react-left.svg",
  react_right:  "/xiaoyan/clawd-react-right.svg",
  react_annoyed:"/xiaoyan/clawd-react-annoyed.svg",
  react_double: "/xiaoyan/clawd-react-double.svg",
  react_jump:   "/xiaoyan/clawd-react-double-jump.svg",
  react_drag:   "/xiaoyan/clawd-react-drag.svg",
};

// ── Agent 名称 → SVG key 映射 ─────────────────────────────────────────────

/** chat:agent_start value.agent_name → svg key */
const CHAT_AGENT_SVG: Record<string, string> = {
  retrieval:        "sweeping",
  planner:          "building",
  literature_scout: "carrying",
  survey:           "working",
  paper_analyst:    "debugger",
  reproduction:     "wizard",
  synthesis:        "ultrathink",
};

/** survey:agent_start agent.name（模糊匹配）→ svg key */
function surveyAgentSvg(name: string): string {
  if (name.includes("检索规划")) return "building";
  if (name.includes("文献检索")) return "sweeping";
  if (name.includes("时序分析")) return "debugger";
  if (name.includes("综述写作")) return "working";
  return "thinking";
}

/** interest:agent_start agent.name（模糊匹配）→ svg key */
function interestAgentSvg(name: string): string {
  if (name.includes("规划") || name.includes("路径")) return "building";
  if (name.includes("筛选") || name.includes("文献")) return "carrying";
  return "thinking";
}

// ── 活跃工作项追踪 ─────────────────────────────────────────────────────────

/** 每个工作项的优先级（决定单个时显示哪个） */
const WORK_PRIORITY: Record<string, number> = {
  wizard: 7, ultrathink: 6, conducting: 5, debugger: 5,
  building: 4, sweeping: 3, carrying: 3, working: 3, juggling: 3, thinking: 2,
};

interface WorkItem { svgKey: string; priority: number; }

/** 从当前活跃工作项决定展示哪个 SVG key */
function resolveWorkSvg(items: Map<string, WorkItem>): string | null {
  if (items.size === 0) return null;
  if (items.size >= 3) return "conducting";
  if (items.size === 2) return "juggling";
  let best: WorkItem | null = null;
  for (const item of items.values()) {
    if (!best || item.priority > best.priority) best = item;
  }
  return best?.svgKey ?? "thinking";
}

// ── 常量 ─────────────────────────────────────────────────────────────────────

const IDLE_TO_SLEEP_MS   = 3 * 60 * 1000;
const CLICK_WINDOW       = 400;
const DRAG_THRESHOLD     = 4;

// ── 组件 ─────────────────────────────────────────────────────────────────────

export default function XiaoYanPet() {
  const [visible, setVisible]   = useState(false);
  const [shownSvg, setShownSvg] = useState(SVG.idle);
  const [opacity, setOpacity]   = useState(1);
  const [pos, setPos]           = useState({ right: 16, bottom: 16 });

  // 状态机核心
  const currentShown  = useRef(SVG.idle);
  const isReacting    = useRef(false);
  const isSleeping    = useRef(false);    // 是否在睡眠序列中
  // 活跃工作项（跨所有工作流共享）
  const activeWork    = useRef<Map<string, WorkItem>>(new Map());
  // 是否有任何工作在跑（用于流式输出但无 agent 的情况）
  const isStreaming    = useRef(false);

  // 计时器
  const idleTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oneshotTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount    = useRef(0);
  const firstClickDir = useRef<"left" | "right" | null>(null);
  const isDragging    = useRef(false);
  const dragStart     = useRef({ x: 0, y: 0, right: 16, bottom: 16 });

  const objectRef     = useRef<HTMLObjectElement>(null);

  // ── 核心：SVG 切换 ────────────────────────────────────────────────────────

  const showSvg = useCallback((key: string) => {
    const path = SVG[key] ?? key;
    if (currentShown.current === path) return;
    currentShown.current = path;
    setOpacity(0);
    setTimeout(() => { setShownSvg(path); setOpacity(1); }, 180);
  }, []);

  // ── 回到计算态（优先考虑当前活跃工作）────────────────────────────────────

  const resumeWork = useCallback(() => {
    isReacting.current = false;
    const workSvg = resolveWorkSvg(activeWork.current);
    if (workSvg) {
      showSvg(workSvg);
    } else if (isStreaming.current) {
      showSvg("working");
    } else {
      isSleeping.current = false;
      showSvg("idle");
    }
  }, [showSvg]);

  // ── 交互反应（点击/拖拽） ─────────────────────────────────────────────────

  const playReaction = useCallback((key: string, ms: number) => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    isReacting.current = true;
    showSvg(key);
    reactionTimer.current = setTimeout(() => {
      reactionTimer.current = null;
      resumeWork();
    }, ms);
  }, [showSvg, resumeWork]);

  // ── 一次性反馈（完成/报错） ──────────────────────────────────────────────

  const triggerFeedback = useCallback((key: "attention" | "error", ms: number, afterCb?: () => void) => {
    if (oneshotTimer.current) clearTimeout(oneshotTimer.current);
    isReacting.current = false;
    showSvg(key);
    oneshotTimer.current = setTimeout(() => {
      oneshotTimer.current = null;
      afterCb?.();
      resumeWork();
    }, ms);
  }, [showSvg, resumeWork]);

  // ── 空闲睡眠序列 ─────────────────────────────────────────────────────────

  const startIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (activeWork.current.size > 0 || isStreaming.current) return;
      isSleeping.current = true;
      const steps: [string, number][] = [
        ["yawning", 3000], ["dozing", 3000], ["collapsing", 2500], ["sleeping", 0],
      ];
      let delay = 0;
      for (const [key, dur] of steps) {
        const k = key;
        setTimeout(() => { if (isSleeping.current) showSvg(k); }, delay);
        delay += dur;
      }
    }, IDLE_TO_SLEEP_MS);
  }, [showSvg]);

  const cancelIdleTimer = useCallback(() => {
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    isSleeping.current = false;
  }, []);

  const wakeIfSleeping = useCallback(() => {
    if (!isSleeping.current) return false;
    cancelIdleTimer();
    showSvg("waking");
    setTimeout(() => resumeWork(), 1500);
    return true;
  }, [cancelIdleTimer, showSvg, resumeWork]);

  // ── 工作项管理 ─────────────────────────────────────────────────────────────

  const startWork = useCallback((id: string, svgKey: string) => {
    cancelIdleTimer();
    wakeIfSleeping();
    const priority = WORK_PRIORITY[svgKey] ?? 2;
    activeWork.current.set(id, { svgKey, priority });
    if (!isReacting.current) showSvg(resolveWorkSvg(activeWork.current)!);
  }, [cancelIdleTimer, wakeIfSleeping, showSvg]);

  const finishWork = useCallback((id: string, success = true) => {
    activeWork.current.delete(id);
    if (activeWork.current.size > 0) {
      if (!isReacting.current) showSvg(resolveWorkSvg(activeWork.current)!);
    } else if (isStreaming.current) {
      if (!isReacting.current) showSvg("working");
    } else if (success) {
      triggerFeedback("attention", 4000, () => startIdleTimer());
    } else {
      triggerFeedback("error", 5000, () => startIdleTimer());
    }
  }, [showSvg, triggerFeedback, startIdleTimer]);

  // ── Tauri 事件监听 ────────────────────────────────────────────────────────

  useEffect(() => {
    const unlisten: Array<() => void> = [];
    (async () => {

      // ── chat 多 Agent ────────────────────────────────────────────────────

      unlisten.push(await listen<{ request_id: string; value: { id: string; agent_name: string } }>(
        "chat:agent_start", ({ payload }) => {
          const { id, agent_name } = payload.value;
          const svgKey = CHAT_AGENT_SVG[agent_name] ?? "thinking";
          startWork(id, svgKey);
        }
      ));

      unlisten.push(await listen<{ request_id: string; value: { id: string; status: string } }>(
        "chat:agent_complete", ({ payload }) => {
          const { id, status } = payload.value;
          finishWork(id, status !== "failed");
        }
      ));

      // 流式输出（无 agent 时的 simple 模式）
      unlisten.push(await listen("chat:delta", () => {
        if (!isStreaming.current) {
          isStreaming.current = true;
          cancelIdleTimer();
          wakeIfSleeping();
          if (activeWork.current.size === 0 && !isReacting.current) showSvg("working");
        }
      }));

      unlisten.push(await listen("chat:done", () => {
        isStreaming.current = false;
        if (activeWork.current.size === 0) {
          triggerFeedback("attention", 4000, () => startIdleTimer());
        }
      }));

      unlisten.push(await listen("chat:error", () => {
        isStreaming.current = false;
        activeWork.current.clear();
        triggerFeedback("error", 5000, () => startIdleTimer());
      }));

      // 规划阶段（supervisor 在 routing 之前）
      unlisten.push(await listen("chat:plan", () => {
        cancelIdleTimer(); wakeIfSleeping();
        if (activeWork.current.size === 0 && !isReacting.current) showSvg("thinking");
      }));

      // ── 综述工作流 ────────────────────────────────────────────────────────

      unlisten.push(await listen<{ request_id: string; agent: { id: string; name: string } }>(
        "survey:agent_start", ({ payload }) => {
          const { id, name } = payload.agent;
          startWork(`survey_${id}`, surveyAgentSvg(name));
        }
      ));

      unlisten.push(await listen<{ request_id: string; agent: { id: string } }>(
        "survey:agent_complete", ({ payload }) => {
          finishWork(`survey_${payload.agent.id}`);
        }
      ));

      unlisten.push(await listen("survey:done", () => {
        // survey:agent_complete 会处理最后一步，done 只做托底
        if (activeWork.current.size === 0) {
          triggerFeedback("attention", 4000, () => startIdleTimer());
        }
      }));

      unlisten.push(await listen("survey:error", () => {
        activeWork.current = new Map(
          [...activeWork.current.entries()].filter(([k]) => !k.startsWith("survey_"))
        );
        if (activeWork.current.size === 0) {
          triggerFeedback("error", 5000, () => startIdleTimer());
        }
      }));

      // ── 论文工作流 ────────────────────────────────────────────────────────

      unlisten.push(await listen<{ paper_id: string; status: string }>(
        "paper:status", ({ payload }) => {
          const { paper_id, status } = payload;
          const workId = `paper_${paper_id}`;
          if (status === "parsing" || status === "metadata") {
            startWork(workId, "carrying");
          } else if (status === "analyzing") {
            // 覆盖 carrying → debugger
            activeWork.current.set(workId, { svgKey: "debugger", priority: WORK_PRIORITY.debugger });
            if (!isReacting.current) showSvg(resolveWorkSvg(activeWork.current)!);
          } else if (status === "analyzed" || status === "reproduced") {
            finishWork(workId, true);
          } else if (status === "error" || status === "failed") {
            finishWork(workId, false);
          }
        }
      ));

      // ── 知识/兴趣工作流 ───────────────────────────────────────────────────

      unlisten.push(await listen<{ id: string; agent: { id: string; name: string } }>(
        "interest:agent_start", ({ payload }) => {
          const { id: agentId, name } = payload.agent;
          startWork(`interest_${agentId}`, interestAgentSvg(name));
        }
      ));

      unlisten.push(await listen<{ id: string; agent: { id: string } }>(
        "interest:agent_complete", ({ payload }) => {
          finishWork(`interest_${payload.agent.id}`);
        }
      ));

      unlisten.push(await listen("interest:error", () => {
        activeWork.current = new Map(
          [...activeWork.current.entries()].filter(([k]) => !k.startsWith("interest_"))
        );
        if (activeWork.current.size === 0) {
          triggerFeedback("error", 5000, () => startIdleTimer());
        }
      }));

    })();

    startIdleTimer();
    setTimeout(() => setVisible(true), 200);
    return () => { unlisten.forEach(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 眼睛跟踪（仅 idle 状态）───────────────────────────────────────────────

  useEffect(() => {
    let raf: number;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth)  * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (currentShown.current !== SVG.idle) return;
      const doc = objectRef.current?.contentDocument;
      if (!doc) return;
      const eyes = doc.getElementById("eyes-js") as SVGElement | null;
      const body = doc.getElementById("body-js") as SVGElement | null;
      if (!eyes) return;
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      const dx = cx * 3.5, dy = cy * 2.5;
      eyes.setAttribute("transform", `translate(${dx},${dy})`);
      if (body) body.setAttribute("transform", `translate(${dx * 0.33},${dy * 0.33})`);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  // ── 点击交互 ─────────────────────────────────────────────────────────────

  const handleClick = useCallback((clientX: number, containerWidth: number) => {
    if (wakeIfSleeping()) return;
    const isWorking = activeWork.current.size > 0 || isStreaming.current;
    if (isWorking) { playReaction("react_annoyed", 2000); return; }
    if (isReacting.current) return;

    const dir: "left" | "right" = clientX < containerWidth / 2 ? "left" : "right";
    clickCount.current += 1;
    if (clickCount.current === 1) firstClickDir.current = dir;
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }

    if (clickCount.current >= 4) {
      clickCount.current = 0; firstClickDir.current = null;
      playReaction(Math.random() < 0.5 ? "react_double" : "react_jump", 3500);
    } else if (clickCount.current >= 2) {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        const c = clickCount.current; clickCount.current = 0;
        const d = firstClickDir.current; firstClickDir.current = null;
        if (c >= 4)                  playReaction(Math.random() < 0.5 ? "react_double" : "react_jump", 3500);
        else if (Math.random() < 0.5) playReaction("react_annoyed", 3500);
        else                          playReaction(d === "left" ? "react_left" : "react_right", 2500);
      }, CLICK_WINDOW);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        const d = firstClickDir.current;
        clickCount.current = 0; firstClickDir.current = null;
        playReaction(d === "left" ? "react_left" : "react_right", 2500);
      }, CLICK_WINDOW);
    }
  }, [wakeIfSleeping, playReaction]);

  // ── 拖拽处理 ─────────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, right: pos.right, bottom: pos.bottom };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (!isDragging.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      isDragging.current = true;
      if (reactionTimer.current) { clearTimeout(reactionTimer.current); reactionTimer.current = null; }
      isReacting.current = true;
      showSvg("react_drag");
    }
    if (isDragging.current) {
      setPos({ right: Math.max(0, dragStart.current.right - dx), bottom: Math.max(0, dragStart.current.bottom - dy) });
    }
  }, [showSvg]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const wasDrag = isDragging.current;
    isDragging.current = false;
    if (wasDrag) {
      reactionTimer.current = setTimeout(() => { reactionTimer.current = null; resumeWork(); }, 500);
    } else {
      handleClick(e.clientX - e.currentTarget.getBoundingClientRect().left, e.currentTarget.offsetWidth);
    }
  }, [resumeWork, handleClick]);

  // ── 渲染 ─────────────────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-50 select-none"
      style={{ right: pos.right, bottom: pos.bottom, width: 128, height: 128,
               cursor: isDragging.current ? "grabbing" : "grab", touchAction: "none" }}
    >
      <object
        ref={objectRef}
        key={shownSvg}
        data={shownSvg}
        type="image/svg+xml"
        width={128}
        height={128}
        style={{ opacity, transition: "opacity 0.18s ease", display: "block", pointerEvents: "none" }}
        aria-label="小妍"
      />
    </div>
  );
}
