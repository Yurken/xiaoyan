import { Navigate, Route, Routes } from "react-router-dom";
import FocusHome from "../features/focus/FocusHome";
import FocusWorkbench from "../features/focus/FocusWorkbench";
import FocusSettingsWrapper from "../features/focus/FocusSettingsWrapper";
import FocusPageFrame from "../features/focus/FocusPageFrame";
import "../features/focus/focus-layout.css";
import { type LegacyFreeTab } from "../features/focus/shared";
import Planner from "./Planner";
import NoteReader from "./NoteReader";
import PaperReader from "./PaperReader";
import Code from "./Code";
// Other code harnesses remain paused; their routes redirect to DeepSeek.
import AssistantInbox from "./AssistantInbox";
import ResearchTheme from "./ResearchTheme";

function FocusLegacyRouteRedirect({ tab }: { tab: LegacyFreeTab }) {
  const normalized = tab === "copilot" || tab === "xiaoyan" ? "chat" : tab;
  return <Navigate to={`/workbench/free/${normalized}`} replace />;
}

export default function FocusApp() {
  return (
    <div className="rc-focus-shell">
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<FocusHome />} />
          <Route path="/workbench/:interestId" element={<FocusWorkbench />} />
          <Route path="/workbench/:interestId/:tab" element={<FocusWorkbench />} />
          <Route path="/planner" element={<FocusPageFrame title="研究规划"><Planner /></FocusPageFrame>} />
          <Route path="/survey" element={<FocusLegacyRouteRedirect tab="survey" />} />
          <Route path="/papers" element={<FocusLegacyRouteRedirect tab="papers" />} />
          <Route path="/papers/:id/reader" element={<PaperReader />} />
          <Route path="/writing" element={<FocusLegacyRouteRedirect tab="writing" />} />
          <Route path="/knowledge" element={<FocusLegacyRouteRedirect tab="knowledge" />} />
          <Route path="/chat" element={<FocusLegacyRouteRedirect tab="chat" />} />
          <Route path="/xiaoyan" element={<FocusLegacyRouteRedirect tab="xiaoyan" />} />
          <Route path="/copilot" element={<FocusLegacyRouteRedirect tab="copilot" />} />
          <Route path="/tools" element={<FocusLegacyRouteRedirect tab="tools" />} />
          <Route path="/experiment" element={<Navigate to="/" replace />} />
          <Route path="/code" element={<FocusPageFrame title="DeepSeek"><Code /></FocusPageFrame>} />
          <Route path="/codex" element={<Navigate to="/code" replace />} />
          <Route path="/opencode" element={<Navigate to="/code" replace />} />
          <Route path="/pi" element={<Navigate to="/code" replace />} />
          <Route path="/inbox" element={<FocusPageFrame title="收集箱"><AssistantInbox /></FocusPageFrame>} />
          <Route path="/research-theme/:id" element={<FocusPageFrame title="研究主题"><ResearchTheme /></FocusPageFrame>} />
          <Route path="/submission" element={<FocusLegacyRouteRedirect tab="submission" />} />
          <Route path="/notes/:id" element={<NoteReader />} />
          <Route path="/settings" element={<FocusSettingsWrapper />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
