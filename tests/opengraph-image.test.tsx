import { describe, expect, it, vi } from "vitest";

import OpenGraphImage from "@/app/opengraph-image";

describe("OpenGraphImage", () => {
  it("renders with the bundled font without external network access", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled"));

    const response = await OpenGraphImage();
    // Vitest/JSDOM cannot pass next/og's internal SVG Uint8Array to Sharp;
    // consuming the stream still exercises font resolution, while Playwright
    // verifies the real route returns a PNG.
    await response.arrayBuffer().catch(() => undefined);

    expect(response.headers.get("content-type")).toBe("image/png");
    const externalCalls = fetchSpy.mock.calls.filter(([input]) => /^https?:/u.test(String(input)));
    expect(externalCalls).toEqual([]);
    fetchSpy.mockRestore();
  });
});
