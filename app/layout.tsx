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
          // 同时恢复主题选择（本地存储优先，否则跟随系统），避免暗色用户首帧白屏。
          dangerouslySetInnerHTML={{
            __html: 'try{if(window.sessionStorage.getItem("opening-loader-played-v1"))document.documentElement.dataset.openingLoaderSeen="1";var t=window.localStorage.getItem("curation-theme");if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.curationTheme=t}catch{}',
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#site-main">跳到主要内容</a>
        <OpeningLoader />
        {children}
      </body>
    </html>
  );
}
