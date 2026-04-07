import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@research-copilot/types";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} | 科研协作工作台`,
  description: `${PRODUCT_NAME} 会帮你规划方向、检索文献、解析论文并沉淀知识，让科研推进更连贯。`,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
