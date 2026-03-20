import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { FileText, MessageSquare, BookOpen, Settings as SettingsIcon } from "lucide-react";
import Papers from "./pages/Papers";
import Copilot from "./pages/Copilot";
import Knowledge from "./pages/Knowledge";
import Settings from "./pages/Settings";

const navItems = [
  { to: "/papers", icon: FileText, label: "论文库" },
  { to: "/copilot", icon: MessageSquare, label: "Copilot" },
  { to: "/knowledge", icon: BookOpen, label: "知识库" },
  { to: "/settings", icon: SettingsIcon, label: "设置" },
];

export default function App() {
  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar */}
      <aside className="w-14 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-1">
        <div className="mb-4 w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">智</span>
        </div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-600"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`
            }
          >
            <Icon className="w-5 h-5" />
          </NavLink>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/papers" replace />} />
          <Route path="/papers" element={<Papers />} />
          <Route path="/copilot" element={<Copilot />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
