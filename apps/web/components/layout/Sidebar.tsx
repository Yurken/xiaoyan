"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  BookOpen,
  FileText,
  Library,
  Microscope,
  SlidersHorizontal,
} from "lucide-react";
import { clsx } from "clsx";
import { MAIN_ASSISTANT_NAME, PRODUCT_NAME } from "@research-copilot/types";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "工作台" },
  { href: "/planner", icon: Map, label: "方向规划" },
  { href: "/survey", icon: BookOpen, label: "文献调研" },
  { href: "/papers", icon: FileText, label: "论文库" },
  { href: "/knowledge", icon: Library, label: "知识库" },
  { href: "/settings", icon: SlidersHorizontal, label: "设置中心" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isXiaoyanActive = pathname.startsWith("/xiaoyan");

  return (
    <aside
      className="flex w-64 flex-shrink-0 flex-col border-r"
      style={{
        background: "var(--rc-sidebar-bg)",
        borderColor: "var(--rc-border)",
        backdropFilter: "blur(18px)",
      }}
    >
      <div className="px-4 pb-3 pt-4">
        <Link href="/xiaoyan" className="block">
          <div
            className="rounded-[24px] border px-4 py-4 transition-transform duration-150 hover:-translate-y-px"
            style={{
              background: isXiaoyanActive
                ? "color-mix(in srgb, var(--rc-accent) 8%, var(--rc-card-bg))"
                : "var(--rc-card-bg)",
              borderColor: isXiaoyanActive
                ? "color-mix(in srgb, var(--rc-accent) 26%, var(--rc-card-outline))"
                : "var(--rc-card-outline)",
              boxShadow: "var(--rc-card-flat-shadow)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                style={{
                  borderColor: isXiaoyanActive
                    ? "color-mix(in srgb, var(--rc-accent) 24%, var(--rc-card-outline))"
                    : "var(--rc-card-outline)",
                  background: isXiaoyanActive
                    ? "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-card-inset-bg))"
                    : "var(--rc-card-inset-bg)",
                }}
              >
                <Microscope className="h-5 w-5" style={{ color: "var(--rc-accent)" }} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--rc-text)" }}>
                  {PRODUCT_NAME}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--rc-text-muted)" }}>
                  点击进入小妍对话
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-3">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx("flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium transition-all duration-150")}
              style={
                active
                  ? {
                      background: "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-elevated))",
                      borderColor: "color-mix(in srgb, var(--rc-accent) 24%, var(--rc-border))",
                      color: "var(--rc-text)",
                      boxShadow: "var(--rc-card-flat-shadow)",
                    }
                  : {
                      background: "transparent",
                      borderColor: "transparent",
                      color: "var(--rc-text-soft)",
                    }
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-5 py-4" style={{ borderColor: "var(--rc-border)" }}>
        <p className="text-xs" style={{ color: "var(--rc-text-muted)" }}>
          {PRODUCT_NAME} v0.1.4
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--rc-text-muted)" }}>
          主 AI：{MAIN_ASSISTANT_NAME}
        </p>
      </div>
    </aside>
  );
}
