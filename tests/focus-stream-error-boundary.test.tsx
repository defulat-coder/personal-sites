import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FeedErrorState,
  FeedRecoveryFocus,
} from "@/components/focus-stream-error-boundary";

const idleProps = {
  error: new Error("feed unavailable"),
  label: "每日动态",
  onRetrySettled: vi.fn(),
  onRetryStart: vi.fn(),
  retry: vi.fn(),
  retryPhase: "idle" as const,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("FeedErrorState", () => {
  it("announces the failed feed separately from an empty result and retries it", () => {
    const frames: FrameRequestCallback[] = [];
    const retry = vi.fn();
    const onRetryStart = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { rerender } = render(
      <FeedErrorState {...idleProps} onRetryStart={onRetryStart} retry={retry} />,
    );

    expect(screen.getByRole("alert").textContent).toContain("每日动态暂时无法读取");
    expect(screen.queryByText(/暂时没有/u)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "重新读取" }));
    expect(onRetryStart).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();

    rerender(
      <FeedErrorState
        {...idleProps}
        onRetryStart={onRetryStart}
        retry={retry}
        retryPhase="retrying"
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("正在重新读取每日动态");
    expect((screen.getByRole("button", { name: "正在重新读取…" }) as HTMLButtonElement).disabled).toBe(true);

    act(() => frames.shift()?.(0));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("does not steal focus on the first failure and restores it after a retried failure", () => {
    const frames: FrameRequestCallback[] = [];
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { rerender } = render(<FeedErrorState {...idleProps} />);
    expect(document.activeElement).toBe(outside);

    rerender(<FeedErrorState {...idleProps} retryPhase="retrying" />);
    expect(document.activeElement).toBe(outside);

    const retriedError = new Error("feed still unavailable");
    rerender(
      <FeedErrorState
        {...idleProps}
        error={retriedError}
        retryPhase="retrying"
      />,
    );
    expect(idleProps.onRetrySettled).toHaveBeenCalledOnce();
    rerender(<FeedErrorState {...idleProps} error={retriedError} />);
    act(() => frames.shift()?.(0));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "重新读取" }));
    outside.remove();
  });
});

describe("FeedRecoveryFocus", () => {
  it("moves focus to the first recovered item without changing scroll context", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const onRetrySettled = vi.fn();

    render(
      <FeedRecoveryFocus onRetrySettled={onRetrySettled} retryPhase="retrying">
        <a data-content-id="first" href="https://example.com/first">First item</a>
      </FeedRecoveryFocus>,
    );

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "First item" }));
    expect(onRetrySettled).toHaveBeenCalledOnce();
  });
});
