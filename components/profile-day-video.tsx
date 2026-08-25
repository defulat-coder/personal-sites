"use client";

import { Clapperboard, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/profile-day-video.module.css";

export function ProfileDayVideo() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
    videoRef.current?.pause();
    setOpen(false);
  };

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={`curation-home__about-trigger ${styles.trigger}`}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Clapperboard aria-hidden="true" />
        我的一天
      </button>

      <dialog
        aria-describedby="profile-day-description"
        aria-labelledby="profile-day-title"
        className={styles.dialog}
        onCancel={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <div className={styles.frame}>
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
          <video
            className={styles.video}
            controls
            playsInline
            poster="/images/profile/my-day-poster.webp"
            preload="metadata"
            ref={videoRef}
            src="/videos/my-day.mp4"
          />
        </div>
      </dialog>
    </>
  );
}
