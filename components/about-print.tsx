"use client";

import { CircleCheck, LoaderCircle, Printer, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PRINT_DURATION = 2_400;

const TOOTH_COUNT = 36;
const TOOTH_DEPTH = 5;
const toothPoints = Array.from({ length: TOOTH_COUNT * 2 }, (_, index) => {
  const x = 100 - ((index + 1) * 100) / (TOOTH_COUNT * 2);
  const y = index % 2 === 0 ? "100%" : `calc(100% - ${TOOTH_DEPTH}px)`;
  return `${x}% ${y}`;
}).join(", ");
const receiptClipPath = `polygon(0 0, 100% 0, 100% calc(100% - ${TOOTH_DEPTH}px), ${toothPoints})`;

const receiptItems = [
  { company: "PLUS数字科技", meta: "2014—2019 · Java · 服务运维", years: "5 年" },
  { company: "红星美凯龙", meta: "2019—2023 · 业务 · 集团架构", years: "4 年" },
  { company: "喜马拉雅", meta: "2023—2026 · 企业 AI 应用", years: "3 年" },
  { company: "PayerMax", meta: "2026— · OPT · 端到端交付", years: "至今" },
];

export function AboutPrint() {
  const [open, setOpen] = useState(false);
  // portal 常驻到退场动画播完：open 只控制 AnimatePresence 的 presence，
  // 退场结束（onExitComplete）后才卸载 portal，避免退出动画被中途裁掉。
  const [portalActive, setPortalActive] = useState(false);
  const [printing, setPrinting] = useState(false);
  const reduceMotion = useReducedMotion();
  const timersRef = useRef<number[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const close = useCallback(() => {
    setPrinting(false);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [open, close]);

  const openModal = () => {
    setPortalActive(true);
    setOpen(true);
    setPrinting(!reduceMotion);
    if (!reduceMotion) {
      timersRef.current.push(window.setTimeout(() => setPrinting(false), PRINT_DURATION));
    }
  };

  return (
    <>
      <button
        aria-haspopup="dialog"
        className="curation-home__about-trigger"
        onClick={openModal}
        ref={triggerRef}
        type="button"
      >
        <Printer aria-hidden="true" />
        关于我
      </button>

      {portalActive ? createPortal(
        <AnimatePresence
          onExitComplete={() => {
            setPortalActive(false);
            triggerRef.current?.focus();
          }}
        >
          {open ? (
            <div className="about-modal">
              <motion.button
                animate={{ opacity: 1 }}
                aria-label="关闭"
                className="about-modal__backdrop"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                onClick={close}
                tabIndex={-1}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                type="button"
              />
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                aria-label="关于我：个人经历打印稿"
                aria-modal="true"
                className="about-modal__dialog"
                exit={{
                  opacity: 0,
                  scale: 0.99,
                  y: "0.4rem",
                  transition: { duration: reduceMotion ? 0 : 0.18, ease: "easeIn" },
                }}
                initial={{ opacity: 0, scale: 0.98, y: "0.6rem" }}
                ref={dialogRef}
                role="dialog"
                tabIndex={-1}
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={`about-printer${printing ? " is-printing" : ""}`}>
                  <div className="about-printer__machine">
                    <div className="about-printer__screen">
                      {printing ? (
                        <LoaderCircle aria-hidden="true" className="is-spinning" />
                      ) : (
                        <CircleCheck aria-hidden="true" />
                      )}
                      <span aria-live="polite" role="status">
                        {printing ? "正在打印个人经历…" : "打印完成 · 请取走小票"}
                      </span>
                      <button aria-label="关闭" className="about-modal__close" onClick={close} type="button">
                        <X aria-hidden="true" />
                      </button>
                    </div>
                    <div aria-hidden="true" className="about-printer__slot" />
                  </div>

                  <div className="about-printer__output">
                    <article className="about-printer__paper" style={{ clipPath: receiptClipPath }}>
                      <header className="about-receipt__header">
                        <p className="about-receipt__title">陈远 / CHEN YUAN</p>
                        <p className="about-receipt__sub">个人经历 · CAREER RECEIPT</p>
                      </header>
                      <hr className="about-receipt__rule" />
                      <ul className="about-receipt__items">
                        {receiptItems.map((item) => (
                          <li key={item.company}>
                            <span className="about-receipt__line">
                              <span>{item.company}</span>
                              <span>{item.years}</span>
                            </span>
                            <span className="about-receipt__meta">{item.meta}</span>
                          </li>
                        ))}
                      </ul>
                      <hr className="about-receipt__rule" />
                      <p className="about-receipt__total">
                        <span>合计 TOTAL</span>
                        <strong>12 年</strong>
                      </p>
                      <p className="about-receipt__foot">十二年 · 四段路 · 仍在增长</p>
                      <div aria-hidden="true" className="about-receipt__barcode" />
                    </article>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}
    </>
  );
}
