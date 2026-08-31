import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskChat } from "@/components/ask-chat";

const fingerprint = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: { load: fingerprint.load },
}));

vi.mock("@/components/site-section-navigation", () => ({
  ContentSectionNavigation: () => null,
}));

class MockResizeObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

describe("AskChat visitor session recovery", () => {
  beforeEach(() => {
    fingerprint.load.mockReset();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "conversation-id") });
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: false,
      media: query,
      removeEventListener: vi.fn(),
    })));
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("announces a failed session and restores the composer after retry", async () => {
    fingerprint.load
      .mockRejectedValueOnce(new Error("fingerprint unavailable"))
      .mockResolvedValueOnce({
        get: vi.fn().mockResolvedValue({ visitorId: "visitor-id-123456789" }),
      });

    render(<AskChat />);
    const textarea = screen.getByRole("textbox", { name: "输入问题" });

    fireEvent.focus(textarea);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("浏览器会话未建立");
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
    expect(textarea.getAttribute("aria-describedby")).toBe(alert.id);
    expect(textarea.getAttribute("aria-invalid")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "重试建立会话" }));

    await waitFor(() => expect((textarea as HTMLTextAreaElement).disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(textarea.getAttribute("aria-describedby")).toBeNull();
    expect(textarea.getAttribute("aria-invalid")).toBe("false");
    expect(document.activeElement).toBe(textarea);
    expect(fingerprint.load).toHaveBeenCalledTimes(2);
  });
});
