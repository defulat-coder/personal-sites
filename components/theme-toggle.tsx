"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.curationTheme = next ? "dark" : "light";
  };

  return (
    <button aria-label={dark ? "切换为浅色主题" : "切换为深色主题"} className="curation-theme-toggle" onClick={toggle} type="button">
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
