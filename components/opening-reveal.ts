// 首访仪式的会话标记与「档案摊开」入场的事件通道。
// OpeningLoader 在揭幕（上滑）开始时广播事件；内容流的 SectionMotionLifecycle
// 只在仪式本会话未播放过时武装入场阶梯，两条路径共用同一份 sessionStorage 成本模型。

export const OPENING_PLAYED_KEY = "personal-site:opening-loader-played";

const OPENING_REVEAL_EVENT = "site:opening-reveal";

export function hasOpeningPlayedThisSession() {
  try {
    return window.sessionStorage.getItem(OPENING_PLAYED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOpeningPlayed() {
  try {
    window.sessionStorage.setItem(OPENING_PLAYED_KEY, "true");
  } catch {
    // Storage can be disabled; the current visit still reaches its stable final state.
  }
}

export function dispatchOpeningReveal() {
  window.dispatchEvent(new CustomEvent(OPENING_REVEAL_EVENT));
}

export function onOpeningReveal(handler: () => void) {
  window.addEventListener(OPENING_REVEAL_EVENT, handler, { once: true });
  return () => window.removeEventListener(OPENING_REVEAL_EVENT, handler);
}
