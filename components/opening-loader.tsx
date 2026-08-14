"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type LoaderPhase = "preparing" | "playing" | "leaving" | "complete";

const LOADER_SESSION_KEY = "opening-loader-played-v1";
const LOADER_REPLAY_PARAM = "loader";
const subscribeToNothing = () => () => {};

// 带 ?loader 访问时强制重播开场加载层，忽略本会话已看过的标记。
const shouldReplayLoader = () =>
  new URLSearchParams(window.location.search).has(LOADER_REPLAY_PARAM);

export function OpeningLoader() {
  const [phase, setPhase] = useState<LoaderPhase>("preparing");

  // 已看过的会话：首帧由 html[data-opening-loader-seen] 的 CSS 隐藏加载层；
  // 水合时先按服务端快照渲染，随后 useSyncExternalStore 切换到已看过并移除遮罩。
  const seen = useSyncExternalStore(
    subscribeToNothing,
    () =>
      window.sessionStorage.getItem(LOADER_SESSION_KEY) !== null && !shouldReplayLoader(),
    () => false,
  );

  // 角色序列图约 440KB(gzip)，只在挂载后且确实要播放时才渲染 <img>，
  // 避免 SSR HTML 里的 img/preload 让已看过的会话也下载整份序列。
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  const start = useCallback(() => {
    setPhase((current) => (current === "preparing" ? "playing" : current));
  }, []);

  useEffect(() => {
    if (phase !== "preparing" || seen) return;
    const fallback = window.setTimeout(start, 1_200);
    return () => window.clearTimeout(fallback);
  }, [phase, seen, start]);

  useEffect(() => {
    if (phase !== "playing" || seen) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = window.setTimeout(
      () => {
        window.sessionStorage.setItem(LOADER_SESSION_KEY, "true");
        setPhase("leaving");
      },
      prefersReducedMotion ? 160 : 5_000,
    );
    return () => window.clearTimeout(reveal);
  }, [phase, seen]);

  useEffect(() => {
    if (phase === "complete" || seen) return;
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = originalOverflow;
    };
  }, [phase, seen]);

  if (phase === "complete" || seen) return null;

  return (
    <div
      aria-label="正在加载陈远的个人网站"
      aria-live="polite"
      className={`opening-loader opening-loader--${phase}`}
      onAnimationEnd={(event) => {
        if (event.currentTarget === event.target && phase === "leaving") {
          setPhase("complete");
        }
      }}
      role="status"
    >
      <div className="opening-loader__visual">
        <div aria-hidden="true" className="opening-loader__battery">
          <div className="opening-loader__battery-body">
            {Array.from({ length: 5 }, (_, index) => (
              <span className="opening-loader__battery-cell" key={index} />
            ))}
          </div>
          <span className="opening-loader__battery-terminal" />
        </div>
        {mounted ? (
          <Image
            alt=""
            aria-hidden="true"
            className="opening-loader__character"
            decoding="async"
            draggable={false}
            height={685}
            onError={start}
            onLoad={start}
            src="/images/ample-loader-sequence.svg"
            width={700}
          />
        ) : null}
      </div>
      <span className="sr-only">正在加载陈远的个人网站</span>
    </div>
  );
}
