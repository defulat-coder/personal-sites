"use client";

import { catchError, type ErrorInfo } from "next/error";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type FeedErrorBoundaryProps = {
  children: ReactNode;
  label: string;
};

type RetryPhase = "idle" | "retrying";

type FeedErrorFallbackProps = {
  label: string;
  onRetrySettled: () => void;
  onRetryStart: () => void;
  retryPhase: RetryPhase;
};

type FeedRetryContextValue = Pick<FeedErrorFallbackProps, "onRetrySettled" | "retryPhase">;

const FeedRetryContext = createContext<FeedRetryContextValue | null>(null);

export function FeedErrorFallback(
  props: FeedErrorFallbackProps,
  { error, retry }: Pick<ErrorInfo, "error" | "retry">,
) {
  return <FeedErrorState {...props} error={error} retry={retry} />;
}

export function FeedErrorState({
  error,
  label,
  onRetrySettled,
  onRetryStart,
  retry,
  retryPhase,
}: FeedErrorFallbackProps & Pick<ErrorInfo, "error" | "retry">) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstErrorEffectRef = useRef(true);
  const previousErrorRef = useRef(error);
  const retryFrameRef = useRef<number | null>(null);
  const isRetrying = retryPhase === "retrying";

  useEffect(() => () => {
    if (retryFrameRef.current !== null) window.cancelAnimationFrame(retryFrameRef.current);
  }, []);

  useEffect(() => {
    const retryFailed = isRetrying
      && (firstErrorEffectRef.current || previousErrorRef.current !== error);
    firstErrorEffectRef.current = false;
    previousErrorRef.current = error;
    if (!retryFailed) return;

    onRetrySettled();
    retryFrameRef.current = window.requestAnimationFrame(() => {
      retryFrameRef.current = null;
      buttonRef.current?.focus({ preventScroll: true });
    });
  }, [error, isRetrying, onRetrySettled]);

  const handleRetry = () => {
    if (isRetrying) return;
    onRetryStart();
    // 先让可访问状态提交一帧，再由 Next 在 transition 中重新请求边界子树。
    retryFrameRef.current = window.requestAnimationFrame(() => {
      retryFrameRef.current = null;
      retry();
    });
  };

  return (
    <div
      aria-busy={isRetrying}
      className="curation-home__stream-error"
    >
      <p aria-atomic="true" className="curation-home__stream-error-title" role="alert">
        {label}暂时无法读取。
      </p>
      <p>数据服务没有响应，可以重新读取当前内容。</p>
      <span aria-live="polite" className="sr-only" role="status">
        {isRetrying ? `正在重新读取${label}` : ""}
      </span>
      <button disabled={isRetrying} ref={buttonRef} type="button" onClick={handleRetry}>
        {isRetrying ? "正在重新读取…" : "重新读取"}
      </button>
    </div>
  );
}

const CaughtFeedErrorBoundary = catchError(FeedErrorFallback);

export function FeedErrorBoundary({ children, label }: FeedErrorBoundaryProps) {
  const [retryPhase, setRetryPhase] = useState<RetryPhase>("idle");
  const onRetryStart = useCallback(() => setRetryPhase("retrying"), []);
  const onRetrySettled = useCallback(() => setRetryPhase("idle"), []);

  return (
    <FeedRetryContext.Provider value={{ onRetrySettled, retryPhase }}>
      <CaughtFeedErrorBoundary
        label={label}
        onRetrySettled={onRetrySettled}
        onRetryStart={onRetryStart}
        retryPhase={retryPhase}
      >
        {children}
      </CaughtFeedErrorBoundary>
    </FeedRetryContext.Provider>
  );
}

export function FeedRecoveryFocus({
  children,
  onRetrySettled,
  retryPhase,
}: FeedRetryContextValue & { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (retryPhase !== "retrying") return;

    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>("[data-content-id], a[href]")
      ?? content?.closest<HTMLElement>("[data-feed-recovery-root]");
    target?.focus({ preventScroll: true });
    onRetrySettled();
  }, [onRetrySettled, retryPhase]);

  return <div className="curation-home__feed-content" ref={contentRef}>{children}</div>;
}

export function FeedRecoveryTarget({ children }: { children: ReactNode }) {
  const retryContext = useContext(FeedRetryContext);
  if (!retryContext) return children;
  return <FeedRecoveryFocus {...retryContext}>{children}</FeedRecoveryFocus>;
}
