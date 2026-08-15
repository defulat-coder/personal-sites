"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/works.module.css";
import type { WorkShot } from "@/lib/works-types";

type WorksShotStripProps = {
  shots: WorkShot[];
  workTitle: string;
};

/** 作品页面样张带：横向滚动的截图列表，点击开灯箱看大图，灯箱内左右切换同一作品的样张。 */
export function WorksShotStrip({ shots, workTitle }: WorksShotStripProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const active = activeIndex === null ? null : (shots[activeIndex] ?? null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!active && dialog.open) {
      dialog.close();
      document.documentElement.style.overflow = "";
    }
  }, [active]);

  const step = (delta: number) => {
    setActiveIndex((current) =>
      current === null ? current : (current + delta + shots.length) % shots.length,
    );
  };

  return (
    <>
      <div aria-label={`${workTitle} 页面样张`} className={styles.strip}>
        {shots.map((shot, index) => (
          <figure key={shot.src}>
            <button
              aria-label={`放大查看：${shot.label}`}
              className={styles.shotButton}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <Image
                alt={`${workTitle} · ${shot.label}`}
                height={1500}
                sizes="(max-width: 900px) 66vw, 38rem"
                src={shot.src}
                width={2400}
              />
            </button>
            <figcaption>{shot.label}</figcaption>
          </figure>
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
          <figure>
            <Image
              alt={`${workTitle} · ${active.label}`}
              height={1500}
              priority
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
          </figure>
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
