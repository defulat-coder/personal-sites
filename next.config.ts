import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["data/curation.sqlite"],
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
