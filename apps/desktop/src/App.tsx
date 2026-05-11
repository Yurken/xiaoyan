import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
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
import LockScreen from "./features/appLock/LockScreen";
import { useInactivityLock } from "./features/appLock/useInactivityLock";
import { apiClient } from "./lib/client";
import {
  getLayoutMode,
  landscapePathForFocusPath,
  LAYOUT_MODE_CHANGE_EVENT,
  type LayoutMode,
} from "./lib/layoutMode";
import { applyTheme, getTheme, watchSystemTheme } from "./lib/themeMode";
import { applyThemeStyle, getThemeStyle } from "./lib/themeStyle";
import { useAutoUpdate } from "./lib/useAutoUpdate";
import { IS_MACOS_DESKTOP } from "./lib/windowChrome";
import MacWindowDragStrip from "./components/MacWindowDragStrip";
import UpdateNotification from "./components/UpdateNotification";
import XiaoYanPet from "./components/XiaoYanPet";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "首页" },
  { to: "/planner", icon: Map, label: "规划" },
  { to: "/xiaoyan", icon: MessageSquare, label: "对话" },
  { to: "/survey", icon: BookOpen, label: "综述" },
  { to: "/papers", icon: FileText, label: "论文" },
  { to: "/knowledge", icon: Library, label: "知识" },
  { to: "/experiment", icon: FlaskConical, label: "实验" },
  { to: "/submission", icon: Send, label: "投稿" },
  { to: "/tools", icon: Wrench, label: "工具" },
  { to: "/settings", icon: SettingsIcon, label: "设置" },
];

function LandscapeFocusRouteRedirect() {
  const location = useLocation();
  return <Navigate to={landscapePathForFocusPath(location.pathname)} replace />;
}

export default function App() {
  const autoUpdate = useAutoUpdate();
  const navigate = useNavigate();
  const [layoutMode, setCurrentLayoutMode] = useState<LayoutMode>(() => getLayoutMode());
  const [locked, setLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const [lockTimeout, setLockTimeout] = useState(0);

  // Check lock status on mount
  useEffect(() => {
    apiClient.settings.appLock.status()
      .then((status) => {
        setLockTimeout(status.timeoutMinutes);
        if (status.enabled) setLocked(true);
      })
      .catch(() => {})
      .finally(() => setLockChecked(true));
  }, []);

  useInactivityLock(lockTimeout, locked, () => setLocked(true));

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

  useEffect(() => {
    const syncLayoutMode = () => setCurrentLayoutMode(getLayoutMode());

    window.addEventListener("storage", syncLayoutMode);
    window.addEventListener(LAYOUT_MODE_CHANGE_EVENT, syncLayoutMode);

    return () => {
      window.removeEventListener("storage", syncLayoutMode);
      window.removeEventListener(LAYOUT_MODE_CHANGE_EVENT, syncLayoutMode);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        navigate("/settings");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // Lock screen — shown before any app content
  if (locked) {
    return (
      <LockScreen
        onVerified={() => setLocked(false)}
        onVerify={async (password) => {
          try {
            return await apiClient.settings.appLock.verifyPassword(password);
          } catch {
            return false;
          }
        }}
        onGetRecoveryInfo={async () => {
          try {
            return await apiClient.settings.appLock.getRecoveryInfo();
          } catch {
            return { hint: "", question: "" };
          }
        }}
        onVerifyRecovery={async (email, answer) => {
          try {
            return await apiClient.settings.appLock.verifyRecovery(email, answer);
          } catch {
            return false;
          }
        }}
        onResetPassword={async (email, answer, newPassword) => {
          await apiClient.settings.appLock.resetPassword(email, answer, newPassword);
        }}
      />
    );
  }

  // Don't render app until lock status has been checked
  if (!lockChecked) return null;

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
    <div className={`app-shell ${IS_MACOS_DESKTOP ? "app-shell--macos-overlay" : ""}`.trim()}>
      <aside className="app-sidebar">
        <MacWindowDragStrip className="app-sidebar__window-drag-region" />

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            aria-label={label}
            draggable={false}
            className="app-nav-link"
          >
            {({ isActive }) => (
              <span
                className={`app-nav-item ${isActive ? "is-active" : ""}`.trim()}
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
        <MacWindowDragStrip className="app-main__window-drag-region" />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/papers" element={<Papers />} />
          <Route path="/submission" element={<Submission />} />
          <Route path="/experiment" element={<Experiment />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/xiaoyan" element={<Copilot />} />
          <Route path="/copilot" element={<Navigate to="/xiaoyan" replace />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/workbench/*" element={<LandscapeFocusRouteRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <UpdateNotification {...autoUpdate} />
    </div>
  );
}
