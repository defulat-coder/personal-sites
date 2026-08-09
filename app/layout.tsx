import type { Metadata } from "next";

import { OpeningLoader } from "@/components/opening-loader";

import "./globals.css";

export const metadata: Metadata = {
  description:
    "陈远的个人网站：工作履历、工程实践与每日关注。",
  robots: {
    follow: false,
    index: false,
  },
  title: "陈远｜每日关注",
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
