"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PRINT_DURATION = 2_400;
const RETRACT_DURATION = 320;
const LINE_COUNT = 9;
const LINE_INTERVAL = PRINT_DURATION / LINE_COUNT / 1000;

const lineDelays = Array.from(
  { length: LINE_COUNT },
  (_, index) => `${(index * LINE_INTERVAL + 0.12).toFixed(2)}s`,
);

const printRows = [
  { period: "2014—2019", company: "PLUS数字科技", stage: "Java · 服务运维", note: "" },
  { period: "2019—2023", company: "红星美凯龙", stage: "业务 · 集团架构", note: "" },
  { period: "2023—2026", company: "喜马拉雅", stage: "企业 AI 应用", note: "" },
  { period: "2026—", company: "PayerMax", stage: "OPT · 一人团队 · 端到端交付", note: "" },
];

export function AboutPrint() {
  const [mounted, setMounted] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [closing, setClosing] = useState(false);
  const timersRef = useRef<number[]>([]);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setClosing(true);
        setPrinting(false);
        timersRef.current.push(window.setTimeout(() => {
          setMounted(false);
          setClosing(false);
        }, RETRACT_DURATION));
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [mounted]);

  const open = () => {
    setMounted(true);
    setClosing(false);
    setPrinting(true);
    timersRef.current.push(window.setTimeout(() => {
      setPrinting(false);
      const rail = paperRef.current?.closest(".curation-home__profile");
      if (rail) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        rail.scrollTo({ top: rail.scrollHeight, behavior: reduced ? "auto" : "smooth" });
      }
    }, PRINT_DURATION));
  };

  const close = () => {
    setPrinting(false);
    setClosing(true);
    const rail = paperRef.current?.closest(".curation-home__profile");
    if (rail) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rail.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }
    timersRef.current.push(window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, RETRACT_DURATION));
  };

  return (
    <div className="curation-home__about">
      <button
        aria-expanded={mounted}
        className="curation-home__about-trigger"
        onClick={mounted ? close : open}
        type="button"
      >
        <Printer aria-hidden="true" />
        {printing ? "打印中…" : mounted ? "收起" : "关于我"}
      </button>

      {mounted ? (
        <div
          aria-label="关于我：个人经历打印稿"
          className={`curation-home__about-paper${closing ? " is-closing" : ""}`}
          ref={paperRef}
          role="dialog"
        >
          <div className="curation-home__about-sheet">
            <p className="curation-home__about-head about-line" style={{ animationDelay: lineDelays[0] }}>陈远 / CHEN YUAN</p>
            <p className="curation-home__about-sub about-line" style={{ animationDelay: lineDelays[1] }}>个人经历 · 打印稿</p>
            <hr className="about-line" style={{ animationDelay: lineDelays[2] }} />
            <ol>
              {printRows.map((row, index) => (
                <li key={row.period}>
                  <span className="about-line" style={{ animationDelay: lineDelays[3 + index] }}>{row.period}{row.company ? ` ${row.company}` : ""}</span>
                  <span className="about-line" style={{ animationDelay: lineDelays[3 + index] }}>
                    {row.stage}
                    {row.note ? <em>{row.note}</em> : null}
                  </span>
                </li>
              ))}
            </ol>
            <hr className="about-line" style={{ animationDelay: lineDelays[7] }} />
            <p className="curation-home__about-foot about-line" style={{ animationDelay: lineDelays[8] }}>十二年 · 四段路 · 仍在增长</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
