"use client";

import { animate } from "motion/react";
import { useLayoutEffect } from "react";

import {
  clearProfileTransition,
  readProfileTransition,
  stopProfileGhostDrift,
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
    // 先停掉漂移动画（保留当前视觉位置对应的内联样式），再测 ghost 的实时位置，
    // 让飞行动画从当前视觉位置起步，两段运动之间没有跳变。
    stopProfileGhostDrift(avatarGhost);
    stopProfileGhostDrift(summaryGhost);
    const avatarGhostBox = avatarGhost.getBoundingClientRect();
    const summaryGhostBox = summaryGhost.getBoundingClientRect();

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
    const duration = durationByKind[transition.kind] / 1000;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      delete profile.dataset.profileBridging;
      clearProfileTransition();
    };

    // 飞行由 Motion 关键帧驱动：显式 from/to 取自实时测量，不依赖漂移的残留状态。
    const avatarAnimation = animate(
      avatarGhost,
      {
        scale: [avatarStartScale, avatarScale],
        x: [avatarStartX, avatarTranslateX],
        y: [avatarStartY, avatarTranslateY],
      },
      { duration, ease: [0.16, 1, 0.3, 1] },
    );

    const summaryAnimation = animate(
      summaryGhost,
      {
        x: [summaryStartX, summaryTranslateX],
        y: [summaryStartY, summaryTranslateY],
      },
      { duration, ease: [0.16, 1, 0.3, 1] },
    );

    void Promise.allSettled([avatarAnimation, summaryAnimation]).then(finish, finish);

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
