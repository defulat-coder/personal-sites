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
    return box;
  };

  const avatarBox = createGhost(avatar, "avatar");
  const summaryBox = createGhost(summary, "summary");
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
  window.sessionStorage.removeItem(profileTransitionStorageKey);
}
