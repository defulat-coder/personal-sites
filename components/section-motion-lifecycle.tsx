"use client";

import { useEffect } from "react";

import {
  clearSectionTransition,
  enterSectionTransition,
  isSectionTransition,
} from "@/components/section-motion-state";

type SectionMotionLifecycleProps = {
  section: string;
};

export function SectionMotionLifecycle({ section }: SectionMotionLifecycleProps) {
  useEffect(() => {
    const transition = window.sessionStorage.getItem("site-section-transition");
    if (!isSectionTransition(transition)) return;

    enterSectionTransition(transition);
    const timeout = window.setTimeout(clearSectionTransition, 380);
    return () => window.clearTimeout(timeout);
  }, [section]);

  return null;
}
