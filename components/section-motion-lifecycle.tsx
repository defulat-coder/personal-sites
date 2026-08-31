"use client";

import { useLayoutEffect } from "react";

import {
  hasOpeningPlayedThisSession,
  onOpeningReveal,
} from "@/components/opening-reveal";
import {
  clearSectionTransition,
  enterSectionTransition,
  getSectionRevealTargets,
  isSectionTransition,
  playSectionReveal,
  resetSectionMotion,
} from "@/components/section-motion-state";

type SectionMotionLifecycleProps = {
  section: string;
};

function clearRevealStyles(targets: HTMLElement[]) {
  window.requestAnimationFrame(() => {
    for (const element of targets) {
      element.style.removeProperty("opacity");
      element.style.removeProperty("transform");
    }
  });
}

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

  // 首访仪式的「档案摊开」入场：仅当仪式本会话尚未播放时武装——先把目标藏起，
  // 等 OpeningLoader 揭幕广播后按阶梯播放入场；仪式之外（回访/切版块）完全不参与。
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (hasOpeningPlayedThisSession()) return;
    let targets = getSectionRevealTargets();
    if (targets.length === 0) return;
    // 预藏用 fill:forwards 的 WAAPI 压住：内联 opacity 会被流条目的 motion 组件
    // 在水合时改写，动画效果在合成顺序上压过内联样式，任何目标都不会闪出；
    // 压住一直保持到阶梯全部完成，顺带覆盖各目标的 delay 窗口。
    const holdElement = (element: HTMLElement) =>
      element.animate({ opacity: 0 }, { duration: 1, fill: "forwards" });
    let holds = targets.map(holdElement);

    let animations: ReturnType<typeof playSectionReveal> = [];
    let finished = false;
    const releaseHolds = () => {
      for (const hold of holds) hold.cancel();
    };
    const unsubscribe = onOpeningReveal(() => {
      // Suspense 流式补进的条目在武装时可能尚未入 DOM；揭幕帧补查一次并同帧压住，
      // 此刻帘幕刚起、内容尚未露出，不会出现可见的闪隐。
      const fresh = getSectionRevealTargets();
      const added = fresh.filter((element) => !targets.includes(element));
      if (added.length > 0) {
        holds = holds.concat(added.map(holdElement));
        targets = [...targets, ...added];
      }
      animations = playSectionReveal(targets);
      void Promise.all(
        animations.map((animation) => animation.then(() => undefined, () => undefined)),
      ).then(() => {
        finished = true;
        // 动画结束后撤掉内联样式，终态交还 CSS，元素保持可中断、无残留。
        for (const animation of animations) animation.cancel();
        releaseHolds();
        clearRevealStyles(targets);
      });
    });
    // 兜底：揭幕事件若因异常未到达，恢复静态终态，页面绝不留在隐藏态。
    const failsafe = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      unsubscribe();
      releaseHolds();
      clearRevealStyles(targets);
    }, 10_000);

    return () => {
      unsubscribe();
      window.clearTimeout(failsafe);
      releaseHolds();
      for (const animation of animations) animation.stop();
      if (finished) return;
      for (const element of targets) {
        element.style.removeProperty("opacity");
        element.style.removeProperty("transform");
      }
    };
  }, []);

  return null;
}
