import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  description:
    "陈远的 Agentic Software Engineering 与企业级 AI Agent 工程实践。",
  robots: {
    follow: false,
    index: false,
  },
  title: "陈远｜Agentic Software Engineering",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
