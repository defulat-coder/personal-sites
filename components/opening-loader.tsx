"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type LoaderPhase = "preparing" | "playing" | "leaving" | "complete";

const LOADER_SESSION_KEY = "opening-loader-played-v1";
const subscribeToNothing = () => () => {};

export function OpeningLoader() {
  const [phase, setPhase] = useState<LoaderPhase>("preparing");

  // 已看过的会话：首帧由 html[data-opening-loader-seen] 的 CSS 隐藏加载层；
  // 水合时先按服务端快照渲染，随后 useSyncExternalStore 切换到已看过并移除遮罩。
  const seen = useSyncExternalStore(
    subscribeToNothing,
    () => window.sessionStorage.getItem(LOADER_SESSION_KEY) !== null,
    () => false,
  );

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
        <Image
          alt=""
          aria-hidden="true"
          className="opening-loader__character"
          decoding="sync"
          draggable={false}
          height={685}
          onError={start}
          onLoad={start}
          priority
          src="/images/ample-loader-sequence.svg"
          width={700}
        />
      </div>
      <span className="sr-only">正在加载陈远的个人网站</span>
    </div>
  );
}
