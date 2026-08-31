"use client";

import { Clapperboard, X } from "lucide-react";
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/profile-day-video.module.css";

export function ProfileDayVideo() {
  const [open, setOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closingRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const frame = frameRef.current;
    if (!open) {
      if (dialog.open) dialog.close();
      frame?.style.removeProperty("transform");
      frame?.style.removeProperty("opacity");
      return;
    }

    if (!dialog.open) dialog.showModal();
    if (!frame || reduceMotion) {
      frame?.style.removeProperty("transform");
      frame?.style.removeProperty("opacity");
      return;
    }
    // 清掉可能被中断的退场残留，再播对称的入场。
    frame.style.removeProperty("opacity");
    const controls = animate(
      frame,
      { scale: [0.985, 1] },
      { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
    );
    let active = true;
    let cleanupFrame = 0;
    const finish = () => {
      if (!active) return;
      controls.cancel();
      cleanupFrame = window.requestAnimationFrame(() => {
        frame.style.removeProperty("transform");
      });
    };
    void controls.then(finish, finish);
    return () => {
      active = false;
      window.cancelAnimationFrame(cleanupFrame);
      controls.stop();
      frame.style.removeProperty("transform");
    };
  }, [open, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => {
    if (closingRef.current) return;
    videoRef.current?.pause();
    setPlaybackError(false);
    const dialog = dialogRef.current;
    const frame = frameRef.current;
    // 与入场对称的退场：scale 回收 + 淡出后再真正关窗；三条退出路径共用。
    if (reduceMotion || !dialog?.open || !frame) {
      setOpen(false);
      return;
    }
    closingRef.current = true;
    const controls = animate(
      frame,
      { opacity: [1, 0], scale: [1, 0.985] },
      { duration: 0.18, ease: [0.55, 0, 1, 0.45] },
    );
    const finish = () => {
      closingRef.current = false;
      setOpen(false);
    };
    void controls.then(finish, finish);
  };

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={`curation-home__about-trigger ${styles.trigger}`}
        onClick={() => {
          closingRef.current = false;
          setPlaybackError(false);
          setOpen(true);
        }}
        type="button"
      >
        <Clapperboard aria-hidden="true" />
        我的一天
      </button>

      <dialog
        aria-describedby="profile-day-description"
        aria-labelledby="profile-day-title"
        className={styles.dialog}
        onCancel={(event) => {
          // 接管 Esc 的默认关窗，让三条退出路径都走过场动画再关闭。
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <div className={styles.frame} ref={frameRef}>
          <header className={styles.header}>
            <div>
              <h2 id="profile-day-title">我的一天</h2>
              <p id="profile-day-description">
                从清晨起床、乘车通勤和工作分享，到晚间做饭与阅读。15 秒 · 无声
              </p>
            </div>
            <button aria-label="关闭我的一天" className={styles.close} onClick={close} type="button">
              <X aria-hidden="true" />
            </button>
          </header>
          {open ? (
            <>
              <video
                className={styles.video}
                controls
                onCanPlay={() => setPlaybackError(false)}
                onError={() => setPlaybackError(true)}
                playsInline
                poster="/images/profile/my-day-poster.webp"
                preload="metadata"
                ref={videoRef}
                src="/videos/my-day.mp4"
              />
              {playbackError ? (
                <p className={styles.error} role="status">
                  视频暂时无法加载。<a href="/videos/my-day.mp4">直接打开视频</a>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
