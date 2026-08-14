export type ProfileTransitionKind = "collapse" | "expand";

type ProfileTransitionBox = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export type ProfileTransitionPayload = {
  avatar: ProfileTransitionBox;
  kind: ProfileTransitionKind;
  summary: ProfileTransitionBox;
};

const profileTransitionStorageKey = "site-profile-transition";

function getBox(element: Element): ProfileTransitionBox {
  const { height, left, top, width } = element.getBoundingClientRect();
  return { height, left, top, width };
}

function getTransitionKind(from: string, to: string): ProfileTransitionKind | null {
  if (from === "home" && to !== "home") return "collapse";
  if (from !== "home" && to === "home") return "expand";
  return null;
}

const driftByKind: Record<ProfileTransitionKind, { scale: number; y: number }> = {
  collapse: { scale: 0.95, y: -10 },
  expand: { scale: 1.05, y: 10 },
};

// 导航提交前让 ghost 先朝飞行终点方向缓慢漂移，避免点击后到飞行动画启动之间
// 出现“冻结帧”。桥段（ProfileTransitionBridge）会从 ghost 的实时位置接续飞行，
// 两段运动在数学上无缝衔接。duration 需覆盖 /ask 等真实路由切换的 RSC 等待。
function driftGhost(ghost: HTMLElement, kind: ProfileTransitionKind, withScale: boolean) {
  const drift = driftByKind[kind];
  const from = withScale ? "translate3d(0, 0, 0) scale(1, 1)" : "translate3d(0, 0, 0)";
  const to = withScale
    ? `translate3d(0, ${drift.y}px, 0) scale(${drift.scale}, ${drift.scale})`
    : `translate3d(0, ${drift.y}px, 0)`;
  ghost.animate([{ transform: from }, { transform: to }], {
    duration: 600,
    easing: "cubic-bezier(.3, .8, .5, 1)",
    fill: "forwards",
  });
}

export function beginProfileTransition(from: string, to: string) {
  const kind = getTransitionKind(from, to);
  if (!kind || !window.matchMedia("(max-width: 900px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const avatar = document.querySelector<HTMLElement>(".curation-home__avatar");
  const summary = document.querySelector<HTMLElement>(".curation-home__profile-summary");
  if (!avatar || !summary) return;

  document.querySelectorAll(".profile-transition-ghost").forEach((element) => element.remove());

  const createGhost = (element: HTMLElement, variant: "avatar" | "summary") => {
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.classList.add("profile-transition-ghost", `profile-transition-ghost--${variant}`);
    ghost.setAttribute("aria-hidden", "true");
    ghost.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
    ghost.querySelectorAll("a, button").forEach((child) => child.setAttribute("tabindex", "-1"));

    const box = getBox(element);
    Object.assign(ghost.style, {
      height: `${box.height}px`,
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
    });

    document.body.append(ghost);
    return { box, ghost };
  };

  const avatarResult = createGhost(avatar, "avatar");
  const summaryResult = createGhost(summary, "summary");
  driftGhost(avatarResult.ghost, kind, true);
  driftGhost(summaryResult.ghost, kind, false);
  // 暂缓新视图内容流的渲染，把长列表的布局成本移出飞行启动的关键路径，
  // 由 ProfileTransitionBridge 在飞行开始后解除。
  document.documentElement.dataset.profileFeedHold = "true";
  const avatarBox = avatarResult.box;
  const summaryBox = summaryResult.box;
  document.documentElement.dataset.profileTransition = `leaving-${kind}`;
  window.sessionStorage.setItem(profileTransitionStorageKey, JSON.stringify({
    avatar: avatarBox,
    kind,
    summary: summaryBox,
  } satisfies ProfileTransitionPayload));
}

export function readProfileTransition(): ProfileTransitionPayload | null {
  const raw = window.sessionStorage.getItem(profileTransitionStorageKey);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<ProfileTransitionPayload>;
    if (
      (value.kind !== "collapse" && value.kind !== "expand")
      || !value.avatar
      || !value.summary
      || !Number.isFinite(value.avatar.height)
      || !Number.isFinite(value.avatar.left)
      || !Number.isFinite(value.avatar.top)
      || !Number.isFinite(value.avatar.width)
      || !Number.isFinite(value.summary.height)
      || !Number.isFinite(value.summary.left)
      || !Number.isFinite(value.summary.top)
      || !Number.isFinite(value.summary.width)
    ) {
      return null;
    }

    return value as ProfileTransitionPayload;
  } catch {
    return null;
  }
}

export function clearProfileTransition() {
  document.querySelectorAll(".profile-transition-ghost").forEach((element) => element.remove());
  delete document.documentElement.dataset.profileTransition;
  delete document.documentElement.dataset.profileFeedHold;
  window.sessionStorage.removeItem(profileTransitionStorageKey);
}
