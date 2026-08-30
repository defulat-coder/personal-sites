"use client";

import { useLayoutEffect } from "react";

import {
  clearSectionTransition,
  enterSectionTransition,
  isSectionTransition,
  resetSectionMotion,
} from "@/components/section-motion-state";

type SectionMotionLifecycleProps = {
  section: string;
};

export function SectionMotionLifecycle({ section }: SectionMotionLifecycleProps) {
  useLayoutEffect(() => {
    const transition = window.sessionStorage.getItem("site-section-transition");
    if (!isSectionTransition(transition)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clearSectionTransition();
      return;
    }

    const run = enterSectionTransition(transition);
    if (!run) {
      clearSectionTransition();
      return;
    }

    let active = true;
    let cleanupFrame = 0;
    const finish = () => {
      if (!active) return;
      run.animation.cancel();
      cleanupFrame = window.requestAnimationFrame(() => {
        if (active) clearSectionTransition(run.element);
      });
    };
    void run.animation.then(finish, finish);

    return () => {
      active = false;
      window.cancelAnimationFrame(cleanupFrame);
      run.animation.stop();
      resetSectionMotion(run.element);
    };
  }, [section]);

  return null;
}
