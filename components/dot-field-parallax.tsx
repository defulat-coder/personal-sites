"use client";

import { Pause, Play } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

// 指针视差：弹幕信号层整体跟随指针轻微漂移，松手后弹簧回中。
// reduced-motion 下不挂监听、不施加位移，SSR 与客户端首帧输出一致（均为零位移）。
export function DotFieldParallax({ children }: { children: ReactNode }) {
  const signalsRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<DOMRect | null>(null);
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const staticMotion = reduceMotion || paused;
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const x = useSpring(offsetX, { damping: 24, stiffness: 160 });
  const y = useSpring(offsetY, { damping: 24, stiffness: 160 });

  useEffect(() => {
    const signals = signalsRef.current;
    if (!signals || reduceMotion) return;

    let isVisible = true;
    const syncPlayback = () => {
      signals.toggleAttribute("data-motion-paused", document.hidden || !isVisible);
    };
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
      syncPlayback();
    });
    const resizeObserver = new ResizeObserver(() => {
      boundsRef.current = signals.getBoundingClientRect();
    });
    observer.observe(signals);
    resizeObserver.observe(signals);
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();

    return () => {
      boundsRef.current = null;
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, [reduceMotion]);

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="interactive-dot-field__signals"
        data-user-paused={paused ? "" : undefined}
        ref={signalsRef}
        onPointerEnter={staticMotion ? undefined : (event) => {
          boundsRef.current = event.currentTarget.getBoundingClientRect();
        }}
        onPointerLeave={staticMotion ? undefined : () => {
          offsetX.set(0);
          offsetY.set(0);
        }}
        onPointerMove={staticMotion ? undefined : (event) => {
          const box = boundsRef.current;
          if (!box) return;
          offsetX.set(((event.clientX - box.left) / box.width - 0.5) * 12);
          offsetY.set(((event.clientY - box.top) / box.height - 0.5) * 8);
        }}
        // 始终输出 transform: none，避免服务端未知偏好、客户端 reduced-motion=true 时属性不一致。
        style={{ x: staticMotion ? 0 : x, y: staticMotion ? 0 : y }}
      >
        {children}
      </motion.div>
      <button
        aria-label="暂停技术词条动效"
        aria-pressed={paused}
        className="interactive-dot-field__pause"
        onClick={() => {
          offsetX.set(0);
          offsetY.set(0);
          setPaused((value) => !value);
        }}
        title={paused ? "继续动效" : "暂停动效"}
        type="button"
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>
    </>
  );
}
