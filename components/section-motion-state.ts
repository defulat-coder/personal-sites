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

export { resetSectionMotion };
