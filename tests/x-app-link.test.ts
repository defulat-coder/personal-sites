import { describe, expect, it } from "vitest";

import { getXAppDeepLink, isMobileUserAgent } from "../lib/x-app-link";

describe("getXAppDeepLink", () => {
  it("converts X post URLs to the native status route", () => {
    expect(getXAppDeepLink("https://x.com/author/status/1234567890")).toBe(
      "twitter://status?id=1234567890",
    );
    expect(getXAppDeepLink("https://twitter.com/i/web/status/1234567890")).toBe(
      "twitter://status?id=1234567890",
    );
  });

  it("converts X profile URLs but leaves generic X pages and other sites on the web", () => {
    expect(getXAppDeepLink("https://x.com/defulat-coder")).toBe(
      "twitter://user?screen_name=defulat-coder",
    );
    expect(getXAppDeepLink("https://x.com/explore")).toBeNull();
    expect(getXAppDeepLink("https://github.com/defulat-coder")).toBeNull();
  });
});

describe("isMobileUserAgent", () => {
  it("only enables deep links for mobile browsers", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
  });
});
