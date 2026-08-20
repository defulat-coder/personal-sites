import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["data/curation.sqlite"],
  },
  experimental: {
    // 每日动态/首页改为动态渲染后，SPA 导航默认每次都重新打服务端（含返回列表），
    // 表现为明显的卡顿。给客户端 Router Cache 30 秒窗口：会话内往返即时响应，
    // 超过窗口或整页刷新仍直读数据库，数据新鲜度不受影响。
    staleTimes: { dynamic: 30 },
  },
  poweredByHeader: false,
  reactStrictMode: true,
  // Pi resolves optional model integrations at runtime, which Turbopack cannot
  // statically analyze inside a Route Handler.
  serverExternalPackages: ["@earendil-works/pi-coding-agent", "better-sqlite3"],
  typedRoutes: true,
  // public/ 下的静态资源没有内容哈希，给一周浏览器缓存而非 immutable。
  async headers() {
    return [
      {
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
        source: "/images/:path*",
      },
    ];
  },
};

export default nextConfig;
