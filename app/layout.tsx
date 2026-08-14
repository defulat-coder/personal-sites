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
    <html data-scroll-behavior="smooth" lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          // 在首帧绘制前标记已看过开场动画的会话，CSS 直接隐藏加载层，避免白幕闪烁。
          dangerouslySetInnerHTML={{
            __html: 'try{if(window.sessionStorage.getItem("opening-loader-played-v1"))document.documentElement.dataset.openingLoaderSeen="1"}catch{}',
          }}
        />
      </head>
      <body>
        <OpeningLoader />
        {children}
      </body>
    </html>
  );
}
