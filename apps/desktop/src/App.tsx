import { Routes, Route, NavLink } from "react-router-dom";
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Library,
  Map,
  MessageSquare,
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

const navItems = [
  { to: "/",          icon: LayoutDashboard, label: "工作台" },
  { to: "/planner",   icon: Map,             label: "规划" },
  { to: "/survey",    icon: BookOpen,        label: "综述" },
  { to: "/papers",    icon: FileText,        label: "论文" },
  { to: "/knowledge", icon: Library,         label: "知识" },
  { to: "/copilot",   icon: MessageSquare,   label: "Copilot" },
  { to: "/tools",     icon: Wrench,          label: "工具" },
  { to: "/settings",  icon: SettingsIcon,    label: "设置" },
];

export default function App() {
  return (
    <div className="flex h-full bg-nm-bg">
      {/* Sidebar */}
      <aside
        className="w-[72px] flex-shrink-0 flex flex-col items-center py-5 gap-2"
        style={{
          background: "linear-gradient(180deg, #F0F4F8 0%, #E8ECF0 100%)",
          boxShadow: "4px 0 12px rgba(0,0,0,0.06)",
        }}
      >
        {/* Logo */}
        <NavLink to="/" title="工作台" className="mb-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-base font-bold"
            style={{
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              boxShadow: "5px 5px 12px rgba(0,62,204,0.4), -3px -3px 8px rgba(58,155,255,0.25)",
            }}
          >
            智
          </div>
        </NavLink>

        {/* Nav items */}
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={label}
            className={({ isActive }) =>
              isActive
                ? "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150"
                : "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150"
            }
          >
            {({ isActive }) => (
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150"
                style={
                  isActive
                    ? {
                        background: "#E8ECF0",
                        boxShadow: "inset 3px 3px 7px #C8CDD3, inset -3px -3px 7px #FFFFFF",
                        color: "#007AFF",
                      }
                    : {
                        background: "transparent",
                        color: "#8E8E93",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLSpanElement).style.boxShadow =
                      "4px 4px 8px #C8CDD3, -4px -4px 8px #FFFFFF";
                    (e.currentTarget as HTMLSpanElement).style.background = "#E8ECF0";
                    (e.currentTarget as HTMLSpanElement).style.color = "#3C3C43";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLSpanElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLSpanElement).style.background = "transparent";
                    (e.currentTarget as HTMLSpanElement).style.color = "#8E8E93";
                  }
                }}
              >
                <Icon className="w-5 h-5" />
              </span>
            )}
          </NavLink>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/planner"    element={<Planner />} />
          <Route path="/survey"     element={<Survey />} />
          <Route path="/papers"     element={<Papers />} />
          <Route path="/tools"      element={<Tools />} />
          <Route path="/copilot"    element={<Copilot />} />
          <Route path="/knowledge"  element={<Knowledge />} />
          <Route path="/settings"   element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
