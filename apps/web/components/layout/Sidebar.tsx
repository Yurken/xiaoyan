"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  BookOpen,
  FileText,
  Library,
  MessageSquare,
  Microscope,
  SlidersHorizontal,
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "工作台" },
  { href: "/planner", icon: Map, label: "方向规划" },
  { href: "/survey", icon: BookOpen, label: "文献调研" },
  { href: "/papers", icon: FileText, label: "论文库" },
  { href: "/knowledge", icon: Library, label: "知识库" },
  { href: "/copilot", icon: MessageSquare, label: "Copilot" },
  { href: "/settings", icon: SlidersHorizontal, label: "设置中心" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-200">
        <Microscope className="w-6 h-6 text-brand-600 mr-2" />
        <span className="font-bold text-gray-900 text-base">智研 Copilot</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">智研 Copilot v0.1.4</p>
      </div>
    </aside>
  );
}
