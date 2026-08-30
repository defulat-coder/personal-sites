"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";

import styles from "@/components/works.module.css";
import type { WorkShot } from "@/lib/works-types";

type WorksShotStripProps = {
  shots: WorkShot[];
  workTitle: string;
};

type StripShotProps = {
  index: number;
  onOpen: (index: number) => void;
  scrollTick: MotionValue<number>;
  shot: WorkShot;
  stripRef: RefObject<HTMLDivElement | null>;
  workTitle: string;
};

/**
 * 单张样张：随样张带横向滚动，按与可视中心的距离做轻微缩放/透明度强调——
 * 越靠近中间越清晰饱满，滚向两侧则收敛。reduced-motion 下不施加任何变换。
 */
function StripShot({ index, onOpen, scrollTick, shot, stripRef, workTitle }: StripShotProps) {
  const figureRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  // 与样张带可视中心的归一化距离：-1（左缘）→ 0（居中）→ 1（右缘），滚动/尺寸变化时随 scrollTick 重算。
  const centerOffset = useTransform(scrollTick, () => {
    const strip = stripRef.current;
    const figure = figureRef.current;
    if (!strip || !figure) return 0;
    const stripBox = strip.getBoundingClientRect();
    const figureBox = figure.getBoundingClientRect();
    const distance =
      figureBox.left + figureBox.width / 2 - (stripBox.left + stripBox.width / 2);
    return Math.min(1, Math.max(-1, distance / (stripBox.width / 2 || 1)));
  });
  const scale = useTransform(centerOffset, [-1, 0, 1], [0.96, 1, 0.96]);
  const opacity = useTransform(centerOffset, [-1, 0, 1], [0.6, 1, 0.6]);

  return (
    <motion.figure
      ref={figureRef}
      style={{ opacity: reduceMotion ? 1 : opacity, scale: reduceMotion ? 1 : scale }}
    >
      <button
        aria-label={`放大查看：${shot.label}`}
        className={styles.shotButton}
        onClick={() => onOpen(index)}
        type="button"
      >
        <Image
          alt={`${workTitle} · ${shot.label}`}
          height={1500}
          loading={index === 0 ? "eager" : "lazy"}
          sizes="(max-width: 900px) 66vw, 38rem"
          src={shot.src}
          width={2400}
        />
      </button>
      <figcaption>{shot.label}</figcaption>
    </motion.figure>
  );
}

/** 作品页面样张带：横向滚动的截图列表，点击开灯箱看大图，灯箱内左右切换同一作品的样张。 */
export function WorksShotStrip({ shots, workTitle }: WorksShotStripProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // 滚动信号：样张带滚动或尺寸变化时递增，驱动各样张重算与可视中心的距离。
  const scrollTick = useMotionValue(0);
  const active = activeIndex === null ? null : (shots[activeIndex] ?? null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || reduceMotion) return;
    const bump = () => scrollTick.set(scrollTick.get() + 1);
    bump();
    const observer = new ResizeObserver(bump);
    observer.observe(strip);
    window.addEventListener("resize", bump);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", bump);
    };
  }, [reduceMotion, scrollTick]);

  // 桌面鼠标滚轮默认是纵向的，滚不动横向样张带：悬停样张带时把纵向滚轮转成横向滚动，
  // 滚到两端后放行，页面恢复纵向滚动。React 的 onWheel 是 passive 的，必须挂原生监听才能 preventDefault。
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = strip.scrollWidth - strip.clientWidth;
      if (max <= 0) return;
      if (event.deltaY < 0 && strip.scrollLeft <= 0) return;
      if (event.deltaY > 0 && strip.scrollLeft >= max - 1) return;
      event.preventDefault();
      strip.scrollLeft += event.deltaY;
    };
    strip.addEventListener("wheel", onWheel, { passive: false });
    return () => strip.removeEventListener("wheel", onWheel);
  }, []);

  // 自动漂移由 Motion 数值动画驱动：每段从当前位置匀速抵达一侧端点，完成后反向。
  // 悬停/聚焦暂停，手动滚轮或触摸后稍候再恢复；离屏、页面隐藏和 reduced-motion 下不启动。
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || reduceMotion) return;

    let controls: ReturnType<typeof animate> | null = null;
    let direction = 1;
    let disposed = false;
    let focusPaused = false;
    let hasEntered = false;
    let inView = false;
    let pointerPaused = false;
    let resumeTimer = 0;
    const speed = 24; // px/s，刻意放慢
    const isPaused = () => focusPaused || pointerPaused;

    const stop = () => {
      controls?.stop();
      controls = null;
    };
    const clearResume = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = 0;
    };
    const start = () => {
      clearResume();
      stop();
      if (disposed || document.hidden || isPaused() || !inView) return;
      const max = strip.scrollWidth - strip.clientWidth;
      if (max <= 0) return;
      const from = Math.min(max, Math.max(0, strip.scrollLeft));
      let target = direction > 0 ? max : 0;
      if (Math.abs(target - from) < 1) {
        direction *= -1;
        target = direction > 0 ? max : 0;
      }
      controls = animate(from, target, {
        duration: Math.abs(target - from) / speed,
        ease: "linear",
        onComplete: () => {
          controls = null;
          direction *= -1;
          start();
        },
        onUpdate: (value) => {
          strip.scrollLeft = value;
        },
      });
    };
    const schedule = (delay: number) => {
      clearResume();
      stop();
      if (!inView || isPaused() || document.hidden) return;
      resumeTimer = window.setTimeout(start, delay);
    };
    const visibilityObserver = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      if (inView) {
        schedule(hasEntered ? 0 : 1_200);
        hasEntered = true;
      } else {
        clearResume();
        stop();
      }
    });
    visibilityObserver.observe(strip);
    const resizeObserver = new ResizeObserver(() => schedule(0));
    resizeObserver.observe(strip);

    const holdBriefly = () => {
      schedule(2_600);
    };
    const pause = () => {
      clearResume();
      stop();
    };
    const onPointerEnter = () => {
      pointerPaused = true;
      pause();
    };
    const onPointerLeave = () => {
      pointerPaused = false;
      if (!isPaused()) holdBriefly();
    };
    const onFocusIn = () => {
      focusPaused = true;
      pause();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && strip.contains(event.relatedTarget)) return;
      focusPaused = false;
      if (!isPaused()) holdBriefly();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearResume();
        stop();
      } else {
        schedule(0);
      }
    };

    strip.addEventListener("pointerenter", onPointerEnter);
    strip.addEventListener("pointerleave", onPointerLeave);
    strip.addEventListener("focusin", onFocusIn);
    strip.addEventListener("focusout", onFocusOut);
    strip.addEventListener("wheel", holdBriefly, { passive: true });
    strip.addEventListener("touchstart", holdBriefly, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      clearResume();
      stop();
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      strip.removeEventListener("pointerenter", onPointerEnter);
      strip.removeEventListener("pointerleave", onPointerLeave);
      strip.removeEventListener("focusin", onFocusIn);
      strip.removeEventListener("focusout", onFocusOut);
      strip.removeEventListener("wheel", holdBriefly);
      strip.removeEventListener("touchstart", holdBriefly);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reduceMotion]);

  // 灯箱开关只跟随 active 有无，切换样张（active 在序号间变化）不关窗。
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [active]);

  // 灯箱打开期间锁定页面滚动；cleanup 恢复原值（而非置空），
  // 保证灯箱打开状态下组件被卸载（如路由切换）也不会把 overflow:hidden 留在页面上。
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [active]);

  const step = (delta: number) => {
    setActiveIndex((current) =>
      current === null ? current : (current + delta + shots.length) % shots.length,
    );
  };

  return (
    <>
      <div
        aria-label={`${workTitle} 页面样张`}
        className={styles.strip}
        onScroll={reduceMotion ? undefined : () => scrollTick.set(scrollTick.get() + 1)}
        ref={stripRef}
      >
        {shots.map((shot, index) => (
          <StripShot
            index={index}
            key={shot.src}
            onOpen={setActiveIndex}
            scrollTick={scrollTick}
            shot={shot}
            stripRef={stripRef}
            workTitle={workTitle}
          />
        ))}
      </div>

      <dialog
        aria-label={active ? `${workTitle} · ${active.label}` : undefined}
        className={styles.shotDialog}
        onCancel={() => setActiveIndex(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setActiveIndex(null);
        }}
        onClose={() => setActiveIndex(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") step(-1);
          if (event.key === "ArrowRight") step(1);
        }}
        ref={dialogRef}
      >
        {active ? (
          <motion.figure
            animate={{ scale: 1 }}
            initial={reduceMotion ? false : { scale: 0.985 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              alt={`${workTitle} · ${active.label}`}
              height={1500}
              loading="eager"
              sizes="92vw"
              src={active.src}
              width={2400}
            />
            <figcaption>
              {active.label}
              {shots.length > 1 ? (
                <span className={styles.shotDialogCount}>
                  {activeIndex! + 1} / {shots.length}
                </span>
              ) : null}
            </figcaption>
          </motion.figure>
        ) : null}
        {shots.length > 1 ? (
          <>
            <button
              aria-label="上一张"
              className={`${styles.shotDialogNav} ${styles.shotDialogPrev}`}
              onClick={() => step(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              aria-label="下一张"
              className={`${styles.shotDialogNav} ${styles.shotDialogNext}`}
              onClick={() => step(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        ) : null}
        <button
          aria-label="关闭大图"
          className={styles.shotDialogClose}
          onClick={() => setActiveIndex(null)}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </dialog>
    </>
  );
}
