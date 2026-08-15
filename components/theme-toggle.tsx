"use client";

import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

function getThemeSnapshot() {
  return document.documentElement.dataset.curationTheme === "dark";
}

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributeFilter: ["data-curation-theme"],
    attributes: true,
  });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => false);
  const reduceMotion = useReducedMotion();

  const toggle = () => {
    const next = !dark;
    const apply = () => {
      document.documentElement.dataset.curationTheme = next ? "dark" : "light";
      try {
        window.localStorage.setItem("curation-theme", next ? "dark" : "light");
      } catch {
        // 隐私模式等场景下存储不可用，主题仅在当前标签页生效
      }
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startViewTransition = (document as Document & {
      startViewTransition?: (callback: () => void) => void;
    }).startViewTransition;

    if (!reduced && typeof startViewTransition === "function") {
      startViewTransition.call(document, apply);
    } else {
      apply();
    }
  };

  return (
    <button aria-label={dark ? "切换为浅色主题" : "切换为深色主题"} className="curation-theme-toggle" onClick={toggle} type="button">
      {/* 图标旋转入场由 Motion 接管：mode="wait" 保证旧图标先退场再轮换。 */}
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 50, scale: 0.55 }}
          initial={{ opacity: 0, rotate: -50, scale: 0.55 }}
          key={dark ? "sun" : "moon"}
          style={{ display: "grid", placeItems: "center" }}
          transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
