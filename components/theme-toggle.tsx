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
    document.documentElement.dataset.curationTheme = next ? "dark" : "light";
  };

  return (
    <button aria-label={dark ? "切换为浅色主题" : "切换为深色主题"} className="curation-theme-toggle" onClick={toggle} type="button">
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
