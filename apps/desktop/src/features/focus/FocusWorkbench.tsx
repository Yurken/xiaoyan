import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Microscope,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { ResearchInterest } from "@research-copilot/types";
import ResearchWorkbench, {
  type InterestTab,
} from "../knowledge/ResearchWorkbench";
import {
  applyInterestPlanSnapshots,
  useInterestPlanSnapshots,
} from "../knowledge/useInterestPlanRuns";
import MacWindowDragStrip from "../../components/MacWindowDragStrip";
import {
  IS_MACOS_DESKTOP,
  MACOS_WINDOW_DRAG_HEIGHT,
} from "../../lib/windowChrome";
import Survey from "../../pages/Survey";
import Papers from "../../pages/Papers";
import Knowledge from "../../pages/Knowledge";
import Copilot from "../../pages/Copilot";
import Tools from "../../pages/Tools";
import Experiment from "../../pages/Experiment";
import Submission from "../../pages/Submission";
import {
  BASE_INTEREST_TABS,
  FREE_TABS,
  PLANNER_TAB,
  normalizeFreeTab,
  normalizeInterestTab,
  type FreeTab,
} from "./shared";

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rc-focus-tab ${active ? "rc-focus-tab--active" : ""}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rc-focus-stat-chip">
      <span className="text-ink-tertiary">{label}</span>
      <span className="font-semibold text-ink-primary">{value}</span>
    </div>
  );
}

export default function FocusWorkbench() {
  const { interestId, tab } = useParams<{
    interestId: string;
    tab?: string;
  }>();
  const navigate = useNavigate();
  const [interest, setInterest] = useState<ResearchInterest | null>(null);
  const planSnapshots = useInterestPlanSnapshots();
  const [loadingInterest, setLoadingInterest] = useState(false);
  const [interestError, setInterestError] = useState("");
  const [interestTab, setInterestTab] = useState<InterestTab>("papers");
  const [stats, setStats] = useState({ papers: 0, sessions: 0, notes: 0 });
  const isFree = interestId === "free";
  const freeTab = normalizeFreeTab(tab);
  const visibleInterest = useMemo(
    () =>
      interest
        ? applyInterestPlanSnapshots([interest], planSnapshots)[0]
        : null,
    [interest, planSnapshots],
  );

  const interestTabs =
    visibleInterest?.status === "planned"
      ? [PLANNER_TAB, ...BASE_INTEREST_TABS]
      : BASE_INTEREST_TABS;

  useEffect(() => {
    if (isFree) {
      setInterest(null);
      setLoadingInterest(false);
      setInterestError("");
      return;
    }
    if (!interestId) return;

    let cancelled = false;
    setLoadingInterest(true);
    setInterest(null);
    setInterestError("");

    apiClient.knowledge
      .listInterests()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((item) => item.id === interestId);
        if (found) {
          setInterest(found);
          setInterestTab("overview");
          return;
        }
        setInterestError("未找到该研究主题，可能已被删除。");
      })
      .catch((error) => {
        if (!cancelled) setInterestError(formatErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingInterest(false);
      });

    return () => {
      cancelled = true;
    };
  }, [interestId, isFree]);

  useEffect(() => {
    if (isFree || !visibleInterest || !interestId) return;
    const nextTab = normalizeInterestTab(
      tab,
      visibleInterest.status === "planned",
    );
    if (nextTab !== interestTab) {
      setInterestTab(nextTab);
    }
    if (tab !== nextTab) {
      navigate(`/workbench/${interestId}/${nextTab}`, { replace: true });
    }
  }, [visibleInterest, interestId, interestTab, isFree, navigate, tab]);

  const title = isFree
    ? "自由主题"
    : visibleInterest?.folder_name?.trim() ||
      visibleInterest?.topic ||
      "研究主题";

  const tabButtons = isFree
    ? FREE_TABS.map(({ key, label, icon }) => (
        <TabButton
          key={key}
          active={freeTab === key}
          icon={icon}
          label={label}
          onClick={() => navigate(`/workbench/free/${key}`)}
        />
      ))
    : interestTabs.map(({ key, label, icon }) => (
        <TabButton
          key={key}
          active={interestTab === key}
          icon={icon}
          label={label}
          onClick={() => {
            setInterestTab(key);
            navigate(`/workbench/${interestId}/${key}`);
          }}
        />
      ));

  const FreePage = (() => {
    switch (freeTab) {
      case "survey":
        return <Survey hideFolders />;
      case "papers":
        return <Papers hideFolders />;
      case "knowledge":
        return <Knowledge hideFolders />;
      case "xiaoyan":
        return <Copilot hideFolders />;
      case "experiment":
        return <Experiment />;
      case "submission":
        return <Submission />;
      case "tools":
        return <Tools />;
    }
  })();

  return (
    <div className="flex flex-col h-full bg-nm-bg">
      <div className="rc-focus-header flex-shrink-0">
        <MacWindowDragStrip
          style={{ height: `${MACOS_WINDOW_DRAG_HEIGHT}px` }}
        />
        <div
          className="flex items-center gap-2 px-4 min-h-12"
          style={{
            paddingBottom: IS_MACOS_DESKTOP ? "10px" : undefined,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rc-focus-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <p className="text-sm font-semibold text-ink-primary truncate flex-shrink min-w-0 max-w-[200px]">
            {title}
          </p>

          {!isFree && visibleInterest && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <StatChip label="论文" value={stats.papers} />
              <StatChip label="会话" value={stats.sessions} />
              <StatChip label="笔记" value={stats.notes} />
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-0.5">{tabButtons}</div>

          {!isFree && (
            <button
              type="button"
              onClick={() => navigate("/workbench/free/survey")}
              className="rc-focus-btn-secondary flex-shrink-0 ml-1"
            >
              自由主题
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden pt-2">
        {isFree ? (
          FreePage
        ) : loadingInterest ? (
          <div className="flex h-full items-center justify-center gap-2 text-ink-tertiary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">加载主题工作台…</span>
          </div>
        ) : interestError ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="rc-focus-card rounded-[28px] w-full max-w-md p-6 text-center">
              <p className="text-sm font-semibold text-ink-primary">
                无法打开主题工作台
              </p>
              <p className="mt-2 text-xs leading-6 text-apple-red break-all">
                {interestError}
              </p>
              <Button className="mt-4" onClick={() => navigate("/")}>
                返回主题列表
              </Button>
            </div>
          </div>
        ) : visibleInterest ? (
          <ResearchWorkbench
            interest={visibleInterest}
            activeTab={interestTab}
            onStats={(p, s, n) =>
              setStats({ papers: p, sessions: s, notes: n })
            }
          />
        ) : null}
      </div>
    </div>
  );
}
