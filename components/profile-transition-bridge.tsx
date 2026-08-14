"use client";

import { useLayoutEffect } from "react";

import {
  clearProfileTransition,
  readProfileTransition,
} from "@/components/profile-transition-state";

type ProfileTransitionBridgeProps = {
  section: string;
};

const durationByKind = {
  collapse: 280,
  expand: 320,
} as const;

export function ProfileTransitionBridge({ section }: ProfileTransitionBridgeProps) {
  useLayoutEffect(() => {
    const transition = readProfileTransition();
    const profile = document.querySelector<HTMLElement>(".curation-home__profile");
    const avatarTarget = profile?.querySelector<HTMLElement>(".curation-home__avatar");
    const summaryTarget = profile?.querySelector<HTMLElement>(".curation-home__profile-summary");
    const avatarGhost = document.querySelector<HTMLElement>(".profile-transition-ghost--avatar");
    const summaryGhost = document.querySelector<HTMLElement>(".profile-transition-ghost--summary");

    if (!transition || !profile || !avatarTarget || !summaryTarget || !avatarGhost || !summaryGhost) {
      clearProfileTransition();
      return;
    }

    profile.dataset.profileBridging = "true";
    // 先测 ghost 的实时位置（可能已被点击时的 drift 动画推移），再取消 drift，
    // 让飞行动画从当前视觉位置起步，两段运动之间没有跳变。
    const avatarGhostBox = avatarGhost.getBoundingClientRect();
    const summaryGhostBox = summaryGhost.getBoundingClientRect();
    avatarGhost.getAnimations().forEach((animation) => animation.cancel());
    summaryGhost.getAnimations().forEach((animation) => animation.cancel());

    const avatarTargetBox = avatarTarget.getBoundingClientRect();
    const summaryTargetBox = summaryTarget.getBoundingClientRect();
    const avatarStartX = avatarGhostBox.left - transition.avatar.left;
    const avatarStartY = avatarGhostBox.top - transition.avatar.top;
    const avatarStartScale = avatarGhostBox.width / transition.avatar.width;
    const summaryStartX = summaryGhostBox.left - transition.summary.left;
    const summaryStartY = summaryGhostBox.top - transition.summary.top;
    const avatarTranslateX = avatarTargetBox.left - transition.avatar.left;
    const avatarTranslateY = avatarTargetBox.top - transition.avatar.top;
    const avatarScale = avatarTargetBox.width / transition.avatar.width;
    const summaryTranslateX = summaryTargetBox.left - transition.summary.left;
    const summaryTranslateY = summaryTargetBox.top - transition.summary.top;
    const duration = durationByKind[transition.kind];
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      delete profile.dataset.profileBridging;
      clearProfileTransition();
    };

    const avatarAnimation = avatarGhost.animate([
      {
        opacity: 1,
        transform: `translate3d(${avatarStartX}px, ${avatarStartY}px, 0) scale(${avatarStartScale}, ${avatarStartScale})`,
      },
      {
        opacity: 1,
        transform: `translate3d(${avatarTranslateX}px, ${avatarTranslateY}px, 0) scale(${avatarScale}, ${avatarScale})`,
      },
    ], {
      duration,
      easing: "cubic-bezier(.16, 1, .3, 1)",
      fill: "forwards",
    });

    const summaryAnimation = summaryGhost.animate([
      { opacity: 1, transform: `translate3d(${summaryStartX}px, ${summaryStartY}px, 0)` },
      { opacity: 1, transform: `translate3d(${summaryTranslateX}px, ${summaryTranslateY}px, 0)` },
    ], {
      duration,
      easing: "cubic-bezier(.16, 1, .3, 1)",
      fill: "forwards",
    });

    void Promise.allSettled([avatarAnimation.finished, summaryAnimation.finished]).then(finish, finish);

    // 飞行已交给合成器，两个帧后解除内容流的渲染暂停——长列表的布局成本
    // 与 ghost 飞行并行执行，不再阻塞飞行启动，也不会造成可见闪烁（内容区
    // 在 leaving-* 清除前仍保持透明）。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) delete document.documentElement.dataset.profileFeedHold;
      });
    });

    return () => {
      cancelled = true;
      avatarAnimation.cancel();
      summaryAnimation.cancel();
    };
  }, [section]);

  return null;
}
