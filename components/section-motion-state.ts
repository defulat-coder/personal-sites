export type SectionTransition = "forward" | "back" | "swap";

const transitionStorageKey = "site-section-transition";

export function isSectionTransition(value: string | null): value is SectionTransition {
  return value === "forward" || value === "back" || value === "swap";
}

export function beginSectionTransition(transition: SectionTransition) {
  document.documentElement.dataset.sectionTransition = `leaving-${transition}`;
  window.sessionStorage.setItem(transitionStorageKey, transition);
}

export function enterSectionTransition(transition: SectionTransition) {
  document.documentElement.dataset.sectionTransition = `entering-${transition}`;
}

export function clearSectionTransition() {
  delete document.documentElement.dataset.sectionTransition;
  window.sessionStorage.removeItem(transitionStorageKey);
}
