"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type LoaderPhase = "preparing" | "playing" | "leaving" | "complete";

const subscribeToNothing = () => () => {};

// 电池五格逐一充电的节拍（秒），与电池颜色由红转绿的主时间线（4.7s）并行。
const CELL_CHARGE_DELAYS = [0.45, 1.4, 2.35, 3.3, 4.25];
const CELL_COLORS = ["#ef4444", "#ef4444", "#f2c94c", "#24cb71"];
const CELL_COLOR_TIMES = [0, 0.18, 0.52, 1];

export function OpeningLoader() {
  const [phase, setPhase] = useState<LoaderPhase>("preparing");
  const reduceMotion = useReducedMotion();

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
    const reveal = window.setTimeout(
      () => setPhase("leaving"),
      reduceMotion ? 160 : 5_000,
    );
    return () => window.clearTimeout(reveal);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase === "complete") return;
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = originalOverflow;
    };
  }, [phase]);

  if (phase === "complete") return null;

  const leaving = phase === "leaving";
  const charging = phase !== "preparing" && !reduceMotion;

  return (
    <motion.div
      animate={leaving ? { y: "-100%" } : { y: 0 }}
      aria-label="正在加载陈远的个人网站"
      aria-live="polite"
      className={`opening-loader opening-loader--${phase}`}
      initial={false}
      onAnimationComplete={() => {
        if (leaving) setPhase("complete");
      }}
      role="status"
      transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div
        animate={{ opacity: phase === "preparing" ? 0 : 1 }}
        className="opening-loader__visual"
        initial={false}
      >
        {/* transform 由 Motion 统一接管（x: -50% 替代原 CSS translateX），签名回弹保留。 */}
        <motion.div
          animate={charging ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          aria-hidden="true"
          className="opening-loader__battery"
          initial={{ x: "-50%", scale: 1 }}
          transition={{
            scale: { delay: 4.48, duration: 0.42, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.55, 1] },
          }}
        >
          <div className="opening-loader__battery-body">
            {CELL_CHARGE_DELAYS.map((delay) => (
              <motion.span
                animate={charging ? {
                  backgroundColor: CELL_COLORS,
                  opacity: 1,
                  scaleY: 1,
                } : {}}
                className="opening-loader__battery-cell"
                initial={{ backgroundColor: "#ef4444", opacity: 0, scaleY: 0.55 }}
                key={delay}
                transition={{
                  backgroundColor: { duration: 4.7, ease: "linear", times: CELL_COLOR_TIMES },
                  opacity: { delay, duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                  scaleY: { delay, duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                }}
              />
            ))}
          </div>
          <span className="opening-loader__battery-terminal" />
        </motion.div>
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
      </motion.div>
      <span className="sr-only">正在加载陈远的个人网站</span>
    </motion.div>
  );
}
