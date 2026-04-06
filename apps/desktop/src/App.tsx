import { useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import {
  BookOpen,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Library,
  Map,
  MessageSquare,
  Send,
  Settings as SettingsIcon,
  Wrench,
} from "lucide-react";
import Home from "./pages/Home";
import Planner from "./pages/Planner";
import Survey from "./pages/Survey";
import Papers from "./pages/Papers";
import Copilot from "./pages/Copilot";
import Knowledge from "./pages/Knowledge";
import Settings from "./pages/Settings";
import Tools from "./pages/Tools";
import Submission from "./pages/Submission";
import Experiment from "./pages/Experiment";
import FocusApp from "./pages/FocusLayout";
import hitLogo from "./assets/hit-logo.svg";
import { getLayoutMode } from "./lib/layoutMode";
import { applyTheme, getTheme, watchSystemTheme } from "./lib/themeMode";
import { useAutoUpdate } from "./lib/useAutoUpdate";
import UpdateNotification from "./components/UpdateNotification";
import XiaoYanPet from "./components/XiaoYanPet";

const layoutMode = getLayoutMode();

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "工作台" },
  { to: "/planner", icon: Map, label: "规划" },
  { to: "/survey", icon: BookOpen, label: "综述" },
  { to: "/papers", icon: FileText, label: "论文" },
  { to: "/knowledge", icon: Library, label: "知识" },
  { to: "/copilot", icon: MessageSquare, label: "小妍" },
  { to: "/experiment", icon: FlaskConical, label: "实验" },
  { to: "/submission", icon: Send, label: "投稿" },
  { to: "/tools", icon: Wrench, label: "工具" },
  { to: "/settings", icon: SettingsIcon, label: "设置" },
];

export default function App() {
  const autoUpdate = useAutoUpdate();

  useEffect(() => {
    applyTheme(getTheme());
    const unwatch = watchSystemTheme(() => { });
    const root = document.getElementById("root");
    if (!root) return () => unwatch();
    root.classList.add("dissolve-in");
    const timer = setTimeout(() => root.classList.remove("dissolve-in"), 600);
    return () => {
      clearTimeout(timer);
      unwatch();
    };
  }, []);

  if (layoutMode === "focus") {
    return (
      <>
        <FocusApp />
        <UpdateNotification {...autoUpdate} />
        <XiaoYanPet />
      </>
    );
  }

  return (
    <div className="flex h-full bg-nm-bg">
      {/* Sidebar */}
      <aside
        className="w-[80px] flex-shrink-0 flex flex-col items-center py-4 gap-0.5 border-r border-black/30"
        style={{
          background: "linear-gradient(180deg, color-mix(in srgb, var(--rc-elevated) 50%, white) 0%, color-mix(in srgb, var(--rc-surface) 50%, white) 100%)",
        }}
      >
        {/* Logo */}
        <NavLink to="/" className="mb-3 mt-1">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={hitLogo} alt="HIT" className="w-10 h-10 object-contain" />
          </div>
        </NavLink>

        {/* Divider */}
        <div className="w-8 h-px mb-2" style={{ background: "linear-gradient(90deg, transparent, var(--rc-border), transparent)" }} />

        {/* Nav items */}
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="w-full flex justify-center px-2"
          >
            {({ isActive }) => (
              <span
                className={[
                  "flex flex-col items-center gap-1 w-full py-2 rounded-2xl transition-all duration-150 cursor-pointer select-none",
                  isActive
                    ? "text-apple-blue"
                    : "text-ink-tertiary hover:text-ink-secondary hover:shadow-nm-sm hover:bg-nm-bg",
                ].join(" ")}
                style={
                  isActive
                    ? {
                      background: "var(--rc-surface)",
                      boxShadow: "var(--rc-inset-shadow)",
                    }
                    : undefined
                }
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-medium leading-none tracking-tight">{label}</span>
              </span>
            )}
          </NavLink>
        ))}

        {/* 小妍伴侣 — 左下角 */}
        <div className="mt-auto">
          <XiaoYanPet inline />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/papers" element={<Papers />} />
          <Route path="/submission" element={<Submission />} />
          <Route path="/experiment" element={<Experiment />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/copilot" element={<Copilot />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <UpdateNotification {...autoUpdate} />
    </div>
  );
}
