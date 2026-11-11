import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Loader2,
  Microscope,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { ResearchInterest } from "@research-copilot/types";
import PlannerComposer from "../knowledge/PlannerComposer";
import {
  applyInterestPlanSnapshots,
  useInterestPlanSnapshots,
} from "../knowledge/useInterestPlanRuns";
import { safeListen } from "../../lib/tauriEvent";
import FocusPageFrame from "./FocusPageFrame";

function InterestCard({
  interest,
  onEnter,
}: {
  interest: ResearchInterest;
  onEnter: () => void;
}) {
  const statusLabel =
    interest.status === "planned"
      ? "已规划"
      : interest.status === "planning"
        ? "生成中"
        : "待规划";
  const statusVariant =
    interest.status === "planned"
      ? "success"
      : interest.status === "planning"
        ? "info"
        : "default";

  return (
    <div className="rc-focus-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex items-center gap-2 mb-1">
          <Microscope className="w-4 h-4 text-apple-blue flex-shrink-0" />
          <p className="text-sm font-semibold text-ink-primary truncate">
            {interest.folder_name?.trim() || interest.topic}
          </p>
        </div>
        {interest.keywords && interest.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pl-6 mt-1.5">
            {interest.keywords.slice(0, 6).map((kw) => (
              <span
                key={kw}
                className="rc-accent-chip max-w-full break-words rounded-full px-2 py-0.5 text-[11px]"
              >
                {kw}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-tertiary truncate pl-6 mt-0.5">
            {interest.topic}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        <button type="button" onClick={onEnter} className="rc-focus-cta">
          工作台
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FreeTopicCard({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="rc-focus-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
          <p className="text-sm font-semibold text-ink-secondary">自由主题</p>
        </div>
        <p className="text-xs text-ink-tertiary pl-6">未分类的对话和论文</p>
      </div>
      <button type="button" onClick={onEnter} className="rc-focus-btn-secondary">
        工作台
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function FocusHome() {
  const navigate = useNavigate();
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const planSnapshots = useInterestPlanSnapshots();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [wizardTopic] = useState("");
  const visibleInterests = useMemo(
    () => applyInterestPlanSnapshots(interests, planSnapshots),
    [interests, planSnapshots],
  );

  const load = () => {
    setLoading(true);
    apiClient.knowledge
      .listInterests()
      .then((data) => {
        setInterests(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(formatErrorMessage(err));
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    let unlisten: (() => void) | undefined;
    let mounted = true;
    void safeListen<{ id: string }>("interest:plan", () => load()).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });
    return () => {
      mounted = false;
      unlisten?.();
      unlisten = undefined;
    };
  }, []);

  return (
    <FocusPageFrame title="研究主题" home>
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="rc-focus-home-content space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-ink-tertiary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">加载中…</span>
            </div>
          ) : error ? (
            <div className="text-sm text-apple-red py-10 text-center">{error}</div>
          ) : (
            <>
              {/* 规划入口 */}
              <div className="rc-focus-card rounded-2xl overflow-hidden">
                {!creating && !discovering && (
                  <div className="flex flex-col items-start justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-primary">
                        研究路线设计器
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-ink-tertiary">
                        把研究主题转成阶段化学习路线、经典论文和潜在切入方向。
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscovering(true)}
                        className="rc-focus-btn-secondary"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        没想好要做什么？
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="rc-focus-cta"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加研究主题
                      </button>
                    </div>
                  </div>
                )}

                {creating && (
                  <div className="p-5">
                    <PlannerComposer
                      initialTopic={wizardTopic || undefined}
                      onCancel={() => setCreating(false)}
                      onCreated={(interest) => {
                        setInterests((prev) => [interest, ...prev]);
                        setCreating(false);
                      }}
                    />
                  </div>
                )}

                {discovering && (
                  <div className="p-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink-primary">
                          帮我找研究主题
                        </p>
                        <button
                          type="button"
                          onClick={() => setDiscovering(false)}
                          className="text-ink-tertiary hover:text-ink-primary"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-ink-tertiary leading-5">
                        回答几个问题，小妍帮你找到适合你的研究切入点。
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscovering(false);
                          setCreating(true);
                        }}
                        className="rc-focus-cta w-full justify-center"
                      >
                        <Sparkles className="w-4 h-4" />
                        前往完整向导
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 研究主题列表 */}
              <div className="flex items-center justify-between px-1 pt-1">
                <p className="text-sm font-semibold text-ink-primary">研究主题</p>
                <p className="text-xs text-ink-tertiary">
                  {visibleInterests.length > 0
                    ? `共 ${visibleInterests.length} 个`
                    : ""}
                </p>
              </div>

              {visibleInterests.length === 0 ? (
                <div className="rc-focus-card-inset rounded-3xl p-10 text-center">
                  <Microscope className="w-10 h-10 text-ink-tertiary mx-auto mb-3" />
                  <p className="text-sm font-semibold text-ink-primary">
                    还没有研究主题
                  </p>
                  <p className="text-xs text-ink-tertiary mt-2 leading-5">
                    点击「添加研究主题」，小妍帮你整理路线和文献。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleInterests.map((interest) => (
                    <InterestCard
                      key={interest.id}
                      interest={interest}
                      onEnter={() => navigate(`/workbench/${interest.id}`)}
                    />
                  ))}
                </div>
              )}

              <div className="pt-1">
                <FreeTopicCard
                  onEnter={() => navigate("/workbench/free")}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </FocusPageFrame>
  );
}
