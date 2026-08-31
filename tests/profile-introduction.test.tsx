import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileIntroduction } from "@/components/profile-introduction";

const motionState = vi.hoisted(() => ({
  animations: [] as Array<{
    finish: () => void;
    stop: ReturnType<typeof vi.fn>;
  }>,
  isVisible: false,
}));

let reducedMotion = false;
const reducedMotionListeners = new Set<() => void>();

class MockResizeObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

vi.mock("motion/react", () => ({
  animate: vi.fn(() => {
    let finish = () => {};
    const promise = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const controls = {
      finish,
      pause: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
      then: promise.then.bind(promise),
    };
    motionState.animations.push(controls);
    return controls;
  }),
  useInView: () => motionState.isVisible,
}));

describe("ProfileIntroduction", () => {
  beforeEach(() => {
    motionState.animations.length = 0;
    motionState.isVisible = false;
    reducedMotion = false;
    reducedMotionListeners.clear();
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      addEventListener: (_type: string, listener: () => void) => reducedMotionListeners.add(listener),
      matches: reducedMotion,
      media: query,
      removeEventListener: (_type: string, listener: () => void) => reducedMotionListeners.delete(listener),
    })));
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(["hidden", "reduced motion"])("stops an active greeting when %s and restores Chinese", async (condition) => {
    const paragraphs = ["稳定的中文正文。"];
    const { rerender } = render(
      <ProfileIntroduction englishParagraphs={["English copy."]} paragraphs={paragraphs} />,
    );

    motionState.isVisible = true;
    rerender(<ProfileIntroduction englishParagraphs={["English copy."]} paragraphs={paragraphs} />);
    expect(motionState.animations).toHaveLength(1);

    await act(async () => {
      motionState.animations[0].finish();
      await Promise.resolve();
    });
    expect(motionState.animations).toHaveLength(2);

    if (condition === "hidden") {
      motionState.isVisible = false;
      rerender(<ProfileIntroduction englishParagraphs={["English copy."]} paragraphs={paragraphs} />);
    } else {
      await act(async () => {
        reducedMotion = true;
        reducedMotionListeners.forEach((listener) => listener());
      });
    }

    expect(motionState.animations[1].stop).toHaveBeenCalledOnce();
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("你好，");
    expect(heading.classList.contains("is-typing")).toBe(false);
    expect(screen.getByText("稳定的中文正文。", { selector: ".sr-only" })).toBeDefined();
  });
});
