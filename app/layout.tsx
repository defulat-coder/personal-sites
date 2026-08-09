import type { Metadata } from "next";

import { OpeningLoader } from "@/components/opening-loader";

import "./globals.css";

export const metadata: Metadata = {
  description:
    "陈远的每日策展：持续记录值得继续思考的技术、产品与 Agent 工程内容。",
  robots: {
    follow: false,
    index: false,
  },
  title: "陈远｜每日策展",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body>
        <OpeningLoader />
        {children}
      </body>
    </html>
  );
}
