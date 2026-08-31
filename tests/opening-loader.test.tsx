import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type HTMLAttributes, type ImgHTMLAttributes, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpeningLoader } from "@/components/opening-loader";

const SESSION_PLAYED_KEY = "personal-site:opening-loader-played";
const motionState = vi.hoisted(() => ({
  onAnimationComplete: undefined as (() => void) | undefined,
  reduceMotion: false,
}));

type MotionDivProps = Omit<HTMLAttributes<HTMLDivElement>, "onAnimationComplete"> & {
  animate?: unknown;
  children?: ReactNode;
  initial?: unknown;
  onAnimationComplete?: () => void;
  transition?: unknown;
};

type MotionSpanProps = HTMLAttributes<HTMLSpanElement> & {
  animate?: unknown;
  initial?: unknown;
  transition?: unknown;
};

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...motionProps }: MotionDivProps) => {
      const props = { ...motionProps };
      if (props.onAnimationComplete) motionState.onAnimationComplete = props.onAnimationComplete;
      delete props.animate;
      delete props.initial;
      delete props.onAnimationComplete;
      delete props.transition;
      return createElement("div", props, children);
    },
    span: (motionProps: MotionSpanProps) => {
      const props = { ...motionProps };
      delete props.animate;
      delete props.initial;
      delete props.transition;
      return createElement("span", props);
    },
  },
  useReducedMotion: () => motionState.reduceMotion,
}));

describe("OpeningLoader", () => {
  beforeEach(() => {
    motionState.onAnimationComplete = undefined;
    motionState.reduceMotion = false;
    window.sessionStorage.clear();
    document.documentElement.style.overflow = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("plays only once per browser session", () => {
    window.sessionStorage.setItem(SESSION_PLAYED_KEY, "true");
    render(<OpeningLoader />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it.each([
    { delay: 5_000, label: "regular motion", reduceMotion: false },
    { delay: 160, label: "reduced motion", reduceMotion: true },
  ])("starts leaving after $delay ms with $label", ({ delay, reduceMotion }) => {
    motionState.reduceMotion = reduceMotion;
    render(<OpeningLoader />);
    fireEvent.load(document.querySelector("img")!);

    act(() => vi.advanceTimersByTime(delay - 1));
    expect(screen.getByRole("status").classList.contains("opening-loader--playing")).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status").classList.contains("opening-loader--leaving")).toBe(true);

    act(() => motionState.onAnimationComplete?.());
    expect(screen.queryByRole("status")).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_PLAYED_KEY)).toBe("true");
  });
});
