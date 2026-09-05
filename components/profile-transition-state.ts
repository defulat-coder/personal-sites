import { animate } from "motion/react";

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
  links: ProfileTransitionBox;
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
// 漂移由 Motion 驱动；桥段启动飞行前通过 stopProfileGhostDrift 停掉漂移，
// 防止两个动画同时写 transform。
const driftControls = new WeakMap<HTMLElement, ReturnType<typeof animate>>();

function driftGhost(ghost: HTMLElement, kind: ProfileTransitionKind, withScale: boolean) {
  const drift = driftByKind[kind];
  const controls = animate(
    ghost,
    withScale
      ? { scale: [1, drift.scale], y: [0, drift.y] }
      : { y: [0, drift.y] },
    { duration: 0.6, ease: [0.3, 0.8, 0.5, 1] },
  );
  driftControls.set(ghost, controls);
}

export function stopProfileGhostDrift(ghost: HTMLElement) {
  const controls = driftControls.get(ghost);
  if (!controls) return;
  controls.stop();
  driftControls.delete(ghost);
}

export function beginProfileTransition(from: string, to: string) {
  const kind = getTransitionKind(from, to);
  if (!kind || !window.matchMedia("(max-width: 900px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const avatar = document.querySelector<HTMLElement>(".curation-home__avatar");
  const summary = document.querySelector<HTMLElement>(".curation-home__identity");
  const links = document.querySelector<HTMLElement>(".curation-home__external-links");
  if (!avatar || !summary || !links) return;

  clearProfileTransition();

  const createGhost = (
    element: HTMLElement,
    variant: "avatar" | "summary" | "links",
    box: ProfileTransitionBox,
  ) => {
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.classList.add("profile-transition-ghost", `profile-transition-ghost--${variant}`);
    ghost.setAttribute("aria-hidden", "true");
    ghost.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
    ghost.querySelectorAll("a, button").forEach((child) => child.setAttribute("tabindex", "-1"));

    Object.assign(ghost.style, {
      margin: "0",
      height: `${box.height}px`,
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
    });

    if (variant === "links") {
      ghost.style.flexWrap = "nowrap";
      // 克隆脱离首页网格后仍保持来源行的间距、字体与触控尺寸。
      const sources = [element, ...element.querySelectorAll<HTMLElement>("*")];
      const copies = [ghost, ...ghost.querySelectorAll<HTMLElement>("*")];
      const properties = ["display", "gap", "align-items", "justify-content", "font-size", "font-weight", "line-height", "color", "padding", "border-left", "min-width", "min-height"];
      sources.forEach((source, index) => {
        const style = getComputedStyle(source);
        properties.forEach((property) => copies[index].style.setProperty(property, style.getPropertyValue(property)));
      });
    }
    return ghost;
  };

  const avatarBox = getBox(avatar);
  const summaryBox = getBox(summary);
  const linksBox = getBox(links);
  // 收起后的头部位于屏外，不把不可见身份复制到屏幕上参与飞行。
  if (avatarBox.width <= 0 || summaryBox.width <= 0
    || avatarBox.top + avatarBox.height <= 0 || avatarBox.top >= window.innerHeight) return false;
  const avatarGhost = createGhost(avatar, "avatar", avatarBox);
  const summaryGhost = createGhost(summary, "summary", summaryBox);
  const linksGhost = createGhost(links, "links", linksBox);
  document.body.append(avatarGhost, summaryGhost, linksGhost);
  driftGhost(avatarGhost, kind, true);
  driftGhost(summaryGhost, kind, false);
  driftGhost(linksGhost, kind, false);
  // 暂缓新视图内容流的渲染，把长列表的布局成本移出飞行启动的关键路径，
  // 由 ProfileTransitionBridge 在飞行开始后解除。
  document.documentElement.dataset.profileFeedHold = "true";
  document.documentElement.dataset.profileTransition = `leaving-${kind}`;
  window.sessionStorage.setItem(profileTransitionStorageKey, JSON.stringify({
    avatar: avatarBox,
    kind,
    summary: summaryBox,
    links: linksBox,
  } satisfies ProfileTransitionPayload));
  return true;
}

export function readProfileTransition(): ProfileTransitionPayload | null {
  const raw = window.sessionStorage.getItem(profileTransitionStorageKey);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<ProfileTransitionPayload>;
    if (
      (value.kind !== "collapse" && value.kind !== "expand")
      || !value.avatar
      || !value.links
      || !value.summary
      || !Number.isFinite(value.links.height)
      || !Number.isFinite(value.links.left)
      || !Number.isFinite(value.links.top)
      || !Number.isFinite(value.links.width)
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
  document.querySelectorAll<HTMLElement>(".profile-transition-ghost").forEach((element) => {
    stopProfileGhostDrift(element);
    element.remove();
  });
  delete document.documentElement.dataset.profileTransition;
  delete document.documentElement.dataset.profileFeedHold;
  window.sessionStorage.removeItem(profileTransitionStorageKey);
}
