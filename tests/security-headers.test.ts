import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

describe("security headers", () => {
  it("applies browser hardening headers to every route", async () => {
    const rules = await nextConfig.headers?.();
    const global = rules?.find(({ source }) => source === "/:path*");

    expect(Object.fromEntries(global?.headers.map(({ key, value }) => [key, value]) ?? [])).toMatchObject({
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });
});
