import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentPropsWithRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DotFieldParallax } from "@/components/dot-field-parallax";

const motionState = vi.hoisted(() => ({
  reduceMotion: false,
  values: [] as Array<{ set: ReturnType<typeof vi.fn> }>,
}));

type MotionDivProps = Omit<ComponentPropsWithRef<"div">, "style"> & {
  children?: ReactNode;
  style?: unknown;
};

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...motionProps }: MotionDivProps) => {
      const props = { ...motionProps };
      delete props.style;
      return createElement("div", props, children);
    },
  },
  useMotionValue: () => {
    const value = { set: vi.fn() };
    motionState.values.push(value);
    return value;
  },
  useReducedMotion: () => motionState.reduceMotion,
  useSpring: (value: unknown) => value,
}));

const observers = vi.hoisted(() => ({
  intersectionDisconnect: vi.fn(),
  resizeCallback: undefined as ResizeObserverCallback | undefined,
  resizeDisconnect: vi.fn(),
}));

class MockIntersectionObserver {
  disconnect = observers.intersectionDisconnect;
  observe = vi.fn();
}

class MockResizeObserver {
  disconnect = observers.resizeDisconnect;
  observe = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    observers.resizeCallback = callback;
  }
}

describe("DotFieldParallax", () => {
  beforeEach(() => {
    motionState.reduceMotion = false;
    motionState.values.length = 0;
    observers.intersectionDisconnect.mockClear();
    observers.resizeCallback = undefined;
    observers.resizeDisconnect.mockClear();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("measures on entry and reuses the cached bounds during pointer moves", () => {
    render(<DotFieldParallax>signals</DotFieldParallax>);
    const signals = screen.getByText("signals");
    const getBounds = vi.spyOn(signals, "getBoundingClientRect").mockReturnValue({
      height: 100,
      left: 20,
      top: 40,
      width: 200,
    } as DOMRect);

    fireEvent.pointerEnter(signals);
    fireEvent.pointerMove(signals, { clientX: 120, clientY: 90 });
    fireEvent.pointerMove(signals, { clientX: 220, clientY: 140 });

    expect(getBounds).toHaveBeenCalledOnce();
    expect(motionState.values[0]?.set).toHaveBeenNthCalledWith(1, 0);
    expect(motionState.values[0]?.set).toHaveBeenNthCalledWith(2, 6);
    expect(motionState.values[1]?.set).toHaveBeenNthCalledWith(1, 0);
    expect(motionState.values[1]?.set).toHaveBeenNthCalledWith(2, 4);
  });

  it("refreshes the cache on resize and disconnects observers on cleanup", () => {
    const { unmount } = render(<DotFieldParallax>signals</DotFieldParallax>);
    const signals = screen.getByText("signals");
    const getBounds = vi.spyOn(signals, "getBoundingClientRect")
      .mockReturnValueOnce({ height: 100, left: 0, top: 0, width: 100 } as DOMRect)
      .mockReturnValueOnce({ height: 200, left: 50, top: 100, width: 400 } as DOMRect);

    fireEvent.pointerEnter(signals);
    observers.resizeCallback?.([], {} as ResizeObserver);
    fireEvent.pointerMove(signals, { clientX: 250, clientY: 200 });

    expect(getBounds).toHaveBeenCalledTimes(2);
    expect(motionState.values[0]?.set).toHaveBeenLastCalledWith(0);
    expect(motionState.values[1]?.set).toHaveBeenLastCalledWith(0);

    unmount();
    expect(observers.intersectionDisconnect).toHaveBeenCalledOnce();
    expect(observers.resizeDisconnect).toHaveBeenCalledOnce();
  });

  it("does not measure or observe with reduced motion", () => {
    motionState.reduceMotion = true;
    render(<DotFieldParallax>signals</DotFieldParallax>);
    const signals = screen.getByText("signals");
    const getBounds = vi.spyOn(signals, "getBoundingClientRect");

    fireEvent.pointerEnter(signals);
    fireEvent.pointerMove(signals, { clientX: 100, clientY: 100 });

    expect(getBounds).not.toHaveBeenCalled();
    expect(observers.resizeCallback).toBeUndefined();
  });
});
