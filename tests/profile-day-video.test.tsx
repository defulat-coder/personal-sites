import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { animate } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileDayVideo } from "@/components/profile-day-video";

vi.mock("motion/react", () => ({
  animate: vi.fn(() => ({
    cancel: vi.fn(),
    stop: vi.fn(),
    // 同步触发完成回调：退场动画在真实环境约 180ms，测试里立即走完成路径。
    then: vi.fn((onFulfilled?: () => void) => {
      onFulfilled?.();
      return Promise.resolve();
    }),
  })),
  useReducedMotion: () => false,
}));

describe("ProfileDayVideo", () => {
  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      close: {
        configurable: true,
        value: vi.fn(function close(this: HTMLDialogElement) {
          this.removeAttribute("open");
        }),
      },
      showModal: {
        configurable: true,
        value: vi.fn(function showModal(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        }),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  });

  it("loads on demand, exposes a failure fallback, and unmounts on close", () => {
    render(<ProfileDayVideo />);

    expect(document.querySelector("video")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "我的一天" }));
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.autoplay).toBe(false);
    expect(video?.controls).toBe(true);
    expect(video?.getAttribute("preload")).toBe("metadata");

    fireEvent.error(video!);
    expect(screen.getByRole("status").textContent).toContain("视频暂时无法加载");
    expect(screen.getByRole("link", { name: "直接打开视频" }).getAttribute("href")).toBe(
      "/videos/my-day.mp4",
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭我的一天" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    // 与入场对称的退场：scale 回收 + 淡出后关窗、卸载视频。
    expect(animate).toHaveBeenLastCalledWith(
      expect.any(HTMLDivElement),
      { opacity: [1, 0], scale: [1, 0.985] },
      expect.objectContaining({ duration: 0.18 }),
    );
    expect(document.querySelector("video")).toBeNull();
  });
});
