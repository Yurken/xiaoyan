import { BookOpen, Radar } from "lucide-react";
import { CapsuleTabs } from "@research-copilot/ui";
import { usePersistentStringState } from "../../hooks/usePersistentStringState";
import InterestsPanel from "../knowledge/InterestsPanel";
import { FieldDynamicsWorkspace } from "../field-dynamics/FieldDynamicsWorkspace";

const PLANNER_TABS = [
  { key: "interests", icon: <BookOpen className="h-4 w-4" />, label: "研究兴趣" },
  { key: "dynamics", icon: <Radar className="h-4 w-4" />, label: "领域动态" },
] as const;

type PlannerTabKey = (typeof PLANNER_TABS)[number]["key"];
const PLANNER_TAB_KEYS = PLANNER_TABS.map((tab) => tab.key);

export function PlannerWorkspace() {
  const [activeTab, setActiveTab] = usePersistentStringState<PlannerTabKey>(
    "rc:planner:active-tab",
    "interests",
    PLANNER_TAB_KEYS,
  );

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <div className="app-header shrink-0 px-6 pb-3">
        <CapsuleTabs
          options={PLANNER_TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
          value={activeTab}
          onChange={(value) => setActiveTab(value as PlannerTabKey)}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "interests" ? (
          <div className="h-full overflow-y-auto px-6 pt-2 pb-6">
            <InterestsPanel />
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            <FieldDynamicsWorkspace />
          </div>
        )}
      </div>
    </div>
  );
}
