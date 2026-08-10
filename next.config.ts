import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Pi resolves optional model integrations at runtime, which Turbopack cannot
  // statically analyze inside a Route Handler.
  serverExternalPackages: ["@earendil-works/pi-coding-agent"],
  typedRoutes: true,
};

export default nextConfig;
