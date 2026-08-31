"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/works.module.css";
import type { WorkShot } from "@/lib/works-types";

type WorksShotStripProps = {
  shots: WorkShot[];
  workTitle: string;
};

// 灯箱样张切换的方向语言：从样张带点开是缩放就位（null），
// 左右切换沿点击方向横移滑入（+1 下一张自右入，-1 上一张自左入）。
const shotDialogVariants = {
  enter: (direction: number | null) =>
    direction === null
      ? { opacity: 0, scale: 0.985, x: 0 }
      : { opacity: 0, scale: 1, x: direction * 28 },
  center: { opacity: 1, scale: 1, x: 0 },
  exit: (direction: number | null) =>
    direction === null
      ? { opacity: 0, scale: 0.985, x: 0 }
      : { opacity: 0, scale: 1, x: direction * -28 },
};

type StripShotProps = {
  index: number;
  onOpen: (index: number) => void;
  shot: WorkShot;
  workTitle: string;
};

function StripShot({ index, onOpen, shot, workTitle }: StripShotProps) {
  return (
    <figure>
      <button
        aria-label={`放大查看：${shot.label}`}
        className={styles.shotButton}
        onClick={() => onOpen(index)}
        type="button"
      >
        <Image
          alt={`${workTitle} · ${shot.label}`}
          fetchPriority={index < 2 ? "high" : undefined}
          height={1500}
          loading={index < 2 ? "eager" : "lazy"}
          sizes="(max-width: 900px) 66vw, 38rem"
          src={shot.src}
          width={2400}
        />
      </button>
      <figcaption>{shot.label}</figcaption>
    </figure>
  );
}

/** 作品页面样张带：横向滚动的截图列表，点击开灯箱看大图，灯箱内左右切换同一作品的样张。 */
export function WorksShotStrip({ shots, workTitle }: WorksShotStripProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // 入场方向：null 表示从样张带点开（缩放入场），±1 表示灯箱内左右切换（横移滑入）。
  const [entryDirection, setEntryDirection] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const active = activeIndex === null ? null : (shots[activeIndex] ?? null);

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

  const openAt = (index: number) => {
    setEntryDirection(null);
    setActiveIndex(index);
  };

  const step = (delta: number) => {
    setEntryDirection(delta > 0 ? 1 : -1);
    setActiveIndex((current) =>
      current === null ? current : (current + delta + shots.length) % shots.length,
    );
  };

  return (
    <>
      <div
        aria-label={`${workTitle} 页面样张`}
        className={styles.strip}
        ref={stripRef}
      >
        {shots.map((shot, index) => (
          <StripShot
            index={index}
            key={shot.src}
            onOpen={openAt}
            shot={shot}
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
        {/* popLayout：切换时旧图脱出布局反向滑出、新图同帧滑入，图注计数随 key 同步。 */}
        <AnimatePresence custom={entryDirection} initial={false} mode="popLayout">
          {active ? (
            <motion.figure
              animate="center"
              custom={entryDirection}
              exit="exit"
              initial={reduceMotion ? false : "enter"}
              key={active.src}
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
              variants={shotDialogVariants}
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
              <span aria-live="polite" className="sr-only" role="status">
                {active.label}，第 {activeIndex! + 1} 张，共 {shots.length} 张
              </span>
            </motion.figure>
          ) : null}
        </AnimatePresence>
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
