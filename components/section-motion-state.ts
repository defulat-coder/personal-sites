import { animate } from "motion/react";

export type SectionTransition = "forward" | "back" | "swap";

const transitionStorageKey = "site-section-transition";
const exitOffset = {
  back: { x: 12, y: 0 },
  forward: { x: -12, y: 0 },
  swap: { x: 0, y: -5.6 },
} as const;
const enterOffset = {
  back: { x: -14.4, y: 0 },
  forward: { x: 14.4, y: 0 },
  swap: { x: 0, y: 8 },
} as const;

function getSectionMotionElement() {
  return document.querySelector<HTMLElement>(".site-section-motion");
}

function resetSectionMotion(element?: HTMLElement) {
  element?.style.removeProperty("opacity");
  element?.style.removeProperty("transform");
}

export function isSectionTransition(value: string | null): value is SectionTransition {
  return value === "forward" || value === "back" || value === "swap";
}

export function beginSectionTransition(transition: SectionTransition) {
  window.sessionStorage.setItem(transitionStorageKey, transition);
  const element = getSectionMotionElement();
  if (!element) return null;
  const { x, y } = exitOffset[transition];
  return animate(
    element,
    { opacity: [1, 0], x: [0, x], y: [0, y] },
    { duration: 0.13, ease: [0.55, 0, 1, 0.45] },
  );
}

export function enterSectionTransition(transition: SectionTransition) {
  const element = getSectionMotionElement();
  if (!element) return null;
  const { x, y } = enterOffset[transition];
  return {
    animation: animate(
      element,
      { opacity: [0, 1], x: [x, 0], y: [y, 0] },
      { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
    ),
    element,
  };
}

export function clearSectionTransition(element?: HTMLElement) {
  resetSectionMotion(element);
  window.sessionStorage.removeItem(transitionStorageKey);
}

// 「档案摊开」入场：首访仪式揭幕时，刊头与首批内容单元按 32ms 阶梯就位，
// 与内容流追加/筛选揭示共用 0.45rem 上浮 + [0.16,1,0.3,1] 的既有语言。
const revealUnitSelector =
  ":scope .ai-news__day-heading, :scope ol > li:not(.curation-home__stream-status)";
const REVEAL_MAX_UNITS = 6;
const REVEAL_STAGGER = 0.032;

export function getSectionRevealTargets() {
  const container = document.querySelector<HTMLElement>(".site-section-motion");
  if (!container) return [];
  const targets: HTMLElement[] = [];
  const header = container.querySelector<HTMLElement>(":scope > nav");
  if (header) targets.push(header);
  const units = container.querySelectorAll<HTMLElement>(revealUnitSelector);
  for (const unit of Array.from(units).slice(0, REVEAL_MAX_UNITS)) {
    targets.push(unit);
  }
  return targets;
}

export function playSectionReveal(targets: HTMLElement[]) {
  return targets.map((element, index) =>
    animate(
      element,
      { opacity: [0, 1], y: ["0.45rem", "0rem"] },
      { delay: index * REVEAL_STAGGER, duration: 0.3, ease: [0.16, 1, 0.3, 1] },
    ),
  );
}

export { resetSectionMotion };
