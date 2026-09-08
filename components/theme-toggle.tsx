"use client";

import { Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore } from "react";

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

  const [keyboardAction, setKeyboardAction] = useState(false);
  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    setKeyboardAction(event.detail === 0);
    const next = !dark;
    document.documentElement.dataset.curationTheme = next ? "dark" : "light";
    try {
      window.localStorage.setItem("curation-theme", next ? "dark" : "light");
    } catch {
      // Storage restrictions must not prevent a theme change.
    }
  };

  return (
    <button aria-label={dark ? "切换为浅色主题" : "切换为深色主题"} className="curation-theme-toggle" onClick={toggle} type="button">
      <motion.span
        animate={{ transform: dark ? "rotate(0deg)" : "rotate(-12deg)" }}
        initial={false}
        style={{ display: "grid", placeItems: "center" }}
        transition={{ duration: reduceMotion || keyboardAction ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
      >
        {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </motion.span>
    </button>
  );
}
