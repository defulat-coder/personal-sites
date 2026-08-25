"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { ReactNode } from "react";

// 指针视差：弹幕信号层整体跟随指针轻微漂移，松手后弹簧回中。
// reduced-motion 下不挂监听、不施加位移，SSR 与客户端首帧输出一致（均为零位移）。
export function DotFieldParallax({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const x = useSpring(offsetX, { damping: 24, stiffness: 160 });
  const y = useSpring(offsetY, { damping: 24, stiffness: 160 });

  return (
    <motion.div
      aria-hidden="true"
      className="interactive-dot-field__signals"
      onPointerLeave={reduceMotion ? undefined : () => {
        offsetX.set(0);
        offsetY.set(0);
      }}
      onPointerMove={reduceMotion ? undefined : (event) => {
        const box = event.currentTarget.getBoundingClientRect();
        offsetX.set(((event.clientX - box.left) / box.width - 0.5) * 12);
        offsetY.set(((event.clientY - box.top) / box.height - 0.5) * 8);
      }}
      // 始终输出 transform: none，避免服务端未知偏好、客户端 reduced-motion=true 时属性不一致。
      style={{ x: reduceMotion ? 0 : x, y: reduceMotion ? 0 : y }}
    >
      {children}
    </motion.div>
  );
}
