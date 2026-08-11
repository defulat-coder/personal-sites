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
    const avatarTargetBox = avatarTarget.getBoundingClientRect();
    const summaryTargetBox = summaryTarget.getBoundingClientRect();
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
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1, 1)" },
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
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
      { opacity: 1, transform: `translate3d(${summaryTranslateX}px, ${summaryTranslateY}px, 0)` },
    ], {
      duration,
      easing: "cubic-bezier(.16, 1, .3, 1)",
      fill: "forwards",
    });

    void Promise.allSettled([avatarAnimation.finished, summaryAnimation.finished]).then(finish, finish);

    return () => {
      cancelled = true;
      avatarAnimation.cancel();
      summaryAnimation.cancel();
    };
  }, [section]);

  return null;
}
