import type { Metadata, Viewport } from "next";

import { OpeningLoader } from "@/components/opening-loader";
import { SITE_NAME, SITE_URL } from "@/lib/site";

import "./globals.css";

export const viewport: Viewport = {
  // 支持此提示的手机浏览器在键盘弹出时压缩内容视口，组合器随可用高度排布。
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  description:
    "陈远的个人网站：工作履历、工程实践与每日关注。",
  metadataBase: new URL(SITE_URL),
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
  openGraph: {
    description: "用持续更新的策展、开源判读与项目实践证明工程身份。",
    locale: "zh_CN",
    siteName: SITE_NAME,
    title: SITE_NAME,
    type: "website",
    url: SITE_URL,
  },
  robots: {
    follow: true,
    index: true,
  },
  title: SITE_NAME,
  twitter: {
    card: "summary_large_image",
    description: "用持续更新的策展、开源判读与项目实践证明工程身份。",
    title: SITE_NAME,
  },
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
          // 在首帧绘制前恢复主题选择（本地存储优先，否则跟随系统），避免暗色用户首帧白屏。
          dangerouslySetInnerHTML={{
            __html: 'try{var t=window.localStorage.getItem("curation-theme");if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.curationTheme=t}catch{}',
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
