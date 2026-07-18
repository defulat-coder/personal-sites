import { describe, expect, it } from "vitest";

import { siteFoundation, siteFoundationSchema } from "@/lib/site-foundation";

describe("site foundation", () => {
  it("keeps the runtime contract schema-validated", () => {
    expect(siteFoundation).toEqual({
      packageManager: "pnpm",
      runtime: "nextjs",
      version: 1,
    });
  });

  it("rejects an unpinned package manager contract", () => {
    expect(
      siteFoundationSchema.safeParse({
        packageManager: "npm",
        runtime: "nextjs",
        version: 1,
      }).success,
    ).toBe(false);
  });
});
