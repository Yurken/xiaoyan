import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Library,
  Map,
  MessageSquare,
  PenLine,
  Send,
  Settings as SettingsIcon,
  Wrench,
} from "lucide-react";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

const Home = lazy(() => import("./pages/Home"));
const Planner = lazy(() => import("./pages/Planner"));
const Survey = lazy(() => import("./pages/Survey"));
const Papers = lazy(() => import("./pages/Papers"));
const Copilot = lazy(() => import("./pages/Copilot"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Settings = lazy(() => import("./pages/Settings"));
const Tools = lazy(() => import("./pages/Tools"));
const Submission = lazy(() => import("./pages/Submission"));
const Experiment = lazy(() => import("./pages/Experiment"));
const Writing = lazy(() => import("./pages/Writing"));
const ResearchTheme = lazy(() => import("./pages/ResearchTheme"));
const FocusApp = lazy(() => import("./pages/FocusLayout"));
import LockScreen from "./features/appLock/LockScreen";
import { APP_LOCK_STATUS_CHANGE_EVENT, type AppLockStatusChangeDetail } from "./features/appLock/shared";
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
import LoginModal from "./features/auth/LoginModal";
import { hasToken } from "./lib/apiBridge";
import { useInterestPlanEventBridge } from "./features/knowledge/useInterestPlanRuns";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "首页" },
  { to: "/planner", icon: Map, label: "规划" },
  { to: "/xiaoyan", icon: MessageSquare, label: "对话" },
  { to: "/survey", icon: BookOpen, label: "综述" },
  { to: "/papers", icon: FileText, label: "论文" },
  { to: "/writing", icon: PenLine, label: "写作" },
  { to: "/knowledge", icon: Library, label: "知识" },
  { to: "/experiment", icon: FlaskConical, label: "实验" },
  { to: "/submission", icon: Send, label: "投稿" },
  { to: "/tools", icon: Wrench, label: "工具" },
  { to: "/settings", icon: SettingsIcon, label: "设置" },
] as const;

function LandscapeFocusRouteRedirect() {
  const location = useLocation();
  return <Navigate to={landscapePathForFocusPath(location.pathname)} replace />;
}

export default function App() {
  const autoUpdate = useAutoUpdate();
  useInterestPlanEventBridge();
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
      .catch((err) => {
        console.warn("Failed to load app lock status:", err);
      })
      .finally(() => setLockChecked(true));


  }, []);

  useInactivityLock(lockTimeout, locked, () => setLocked(true));

  useEffect(() => {
    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<AppLockStatusChangeDetail>).detail;
      setLockTimeout(detail.timeoutMinutes);
      if (!detail.enabled) {
        setLocked(false);
      }
    };

    window.addEventListener(APP_LOCK_STATUS_CHANGE_EVENT, handleStatusChange);
    return () => window.removeEventListener(APP_LOCK_STATUS_CHANGE_EVENT, handleStatusChange);
  }, []);

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

  const [loginOpen, setLoginOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(hasToken());

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
            return { hint: "", question: "", hasEmail: false, hasSecurity: false };
          }
        }}
        onVerifyRecovery={async (email, answer) => {
          return await apiClient.settings.appLock.verifyRecovery(email, answer);
        }}
        onResetPassword={async (email, answer, newPassword) => {
          try {
            await apiClient.settings.appLock.resetPassword(email, answer, newPassword);
          } catch (err) {
            console.warn("Failed to reset password:", err);
            throw err;
          }
        }}
      />
    );
  }

  if (!lockChecked) return null;



  if (layoutMode === "focus") {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" /></div>}>
        <FocusApp />
        <UpdateNotification {...autoUpdate} />
        <XiaoYanPet />
      </Suspense>
    );
  }

  return (
    <>
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

        <div className="app-sidebar__account">
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="app-nav-link"
              aria-label="账号"
              title={loggedIn ? "已登录 — 点击管理账号与同步" : "登录以启用 WebDAV 同步"}
            >
              <span className={`app-nav-item ${loggedIn ? "is-active" : ""}`.trim()}>
                <span className="app-nav-item__marker" />
                <span className="app-nav-item__icon" style={{ fontSize: 18 }}>
                  {loggedIn ? "✓" : "⊙"}
                </span>
                <span className="app-nav-item__label">{loggedIn ? "已登录" : "登录"}</span>
              </span>
            </button>
          </div>

          <div className="app-sidebar__pet">
          <XiaoYanPet inline />
        </div>
      </aside>

      <main className="app-main">
        <MacWindowDragStrip className="app-main__window-drag-region" />
        <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" /></div>}>
          <Routes>
            <Route path="/" element={<RouteErrorBoundary><Home /></RouteErrorBoundary>} />
            <Route path="/planner" element={<RouteErrorBoundary><Planner /></RouteErrorBoundary>} />
            <Route path="/survey" element={<RouteErrorBoundary><Survey /></RouteErrorBoundary>} />
            <Route path="/write" element={<Navigate to="/writing" replace />} />
            <Route path="/papers" element={<RouteErrorBoundary><Papers /></RouteErrorBoundary>} />
            <Route path="/writing" element={<RouteErrorBoundary><Writing /></RouteErrorBoundary>} />
            <Route path="/submission" element={<RouteErrorBoundary><Submission /></RouteErrorBoundary>} />
            <Route path="/experiment" element={<RouteErrorBoundary><Experiment /></RouteErrorBoundary>} />
            <Route path="/tools" element={<RouteErrorBoundary><Tools /></RouteErrorBoundary>} />
            <Route path="/xiaoyan" element={<RouteErrorBoundary><Copilot /></RouteErrorBoundary>} />
            <Route path="/copilot" element={<Navigate to="/xiaoyan" replace />} />
            <Route path="/knowledge" element={<RouteErrorBoundary><Knowledge /></RouteErrorBoundary>} />
            <Route path="/research-theme/:id" element={<RouteErrorBoundary><ResearchTheme /></RouteErrorBoundary>} />
            <Route path="/settings" element={<RouteErrorBoundary><Settings /></RouteErrorBoundary>} />
            <Route path="/workbench/*" element={<LandscapeFocusRouteRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <UpdateNotification {...autoUpdate} />
    </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLoginSuccess={() => navigate("/settings")} />
    </>
  );
}
