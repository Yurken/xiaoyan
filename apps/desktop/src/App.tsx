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
import { applyThemeStyle, getThemeStyle } from "./lib/themeStyle";
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
    applyThemeStyle(getThemeStyle());
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
    <div className="app-shell">
      <aside className="app-sidebar">
        <NavLink to="/" className="app-sidebar__logo" title="返回工作台">
          <img src={hitLogo} alt="HIT" className="h-10 w-10 object-contain" />
        </NavLink>

        <div className="app-sidebar__divider" />

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="app-nav-link"
          >
            {({ isActive }) => (
              <span
                className={`app-nav-item ${isActive ? "is-active" : ""}`}
              >
                <span className="app-nav-item__marker" />
                <Icon className="app-nav-item__icon" />
                <span className="app-nav-item__label">{label}</span>
              </span>
            )}
          </NavLink>
        ))}

        <div className="app-sidebar__pet">
          <XiaoYanPet inline />
        </div>
      </aside>

      <main className="app-main">
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
