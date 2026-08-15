"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type LoaderPhase = "preparing" | "playing" | "leaving" | "complete";

const subscribeToNothing = () => () => {};

export function OpeningLoader() {
  const [phase, setPhase] = useState<LoaderPhase>("preparing");

  // 角色序列图约 440KB(gzip)，水合后再渲染 <img>，避免拖慢 SSR 首帧。
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  const start = useCallback(() => {
    setPhase((current) => (current === "preparing" ? "playing" : current));
  }, []);

  useEffect(() => {
    if (phase !== "preparing") return;
    const fallback = window.setTimeout(start, 1_200);
    return () => window.clearTimeout(fallback);
  }, [phase, start]);

  useEffect(() => {
    if (phase !== "playing") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = window.setTimeout(
      () => setPhase("leaving"),
      prefersReducedMotion ? 160 : 5_000,
    );
    return () => window.clearTimeout(reveal);
  }, [phase]);

  useEffect(() => {
    if (phase === "complete") return;
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = originalOverflow;
    };
  }, [phase]);

  if (phase === "complete") return null;

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
