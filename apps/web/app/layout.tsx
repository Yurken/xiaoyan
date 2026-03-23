import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MAIN_ASSISTANT_NAME, PRODUCT_NAME } from "@research-copilot/types";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} | 主 AI ${MAIN_ASSISTANT_NAME}`,
  description: `${PRODUCT_NAME} 的主 AI ${MAIN_ASSISTANT_NAME}，面向高校学生和科研新手提供全流程科研协作能力。`,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
