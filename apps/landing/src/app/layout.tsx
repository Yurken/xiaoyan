import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '小妍 - 你的专业学术科研助理',
  description: '你的专业学术科研助理',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased font-sans bg-[#f0f2f5] text-gray-900">
        {children}
      </body>
    </html>
  )
}