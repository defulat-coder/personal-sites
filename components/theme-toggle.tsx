"use client";

import { Moon, Sun } from "lucide-react";
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
      {dark ? <Sun key="sun" aria-hidden="true" /> : <Moon key="moon" aria-hidden="true" />}
    </button>
  );
}
