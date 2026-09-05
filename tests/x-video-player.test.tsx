import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderToString } from "react-dom/server";

import { XVideoPlayer } from "@/components/x-video-player";

const motionState = vi.hoisted(() => ({ reduceMotion: false }));

vi.mock("motion/react", () => ({
  useReducedMotion: () => motionState.reduceMotion,
}));

describe("XVideoPlayer", () => {
  beforeEach(() => {
    motionState.reduceMotion = false;
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("keeps server-rendered GIFs still until the browser motion preference is known", () => {
    const html = renderToString(<XVideoPlayer isAnimatedGif itemTitle="GIF" poster="/poster.jpg" tweetUrl="https://x.com/example/status/1" videoUrl="https://video.twimg.com/video.mp4" />);
    expect(html).not.toContain('autoPlay');
    expect(html).not.toContain('autoplay');
    expect(html).toContain('preload="none"');
  });

  it("does not preload ordinary videos before the visitor presses play", () => {
    render(
      <XVideoPlayer
        isAnimatedGif={false}
        itemTitle="真实条目标题"
        poster="https://pbs.twimg.com/poster.jpg"
        tweetUrl="https://x.com/example/status/1"
        videoUrl="https://video.twimg.com/amplify_video/1/video.mp4"
      />,
    );

    const video = screen.getByLabelText<HTMLVideoElement>("视频：真实条目标题");
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.autoplay).toBe(false);
    expect(video.loop).toBe(false);
  });

  it("names an animated GIF from its real entry title and respects reduced motion", () => {
    motionState.reduceMotion = true;
    render(
      <XVideoPlayer
        isAnimatedGif
        itemTitle="另一条真实标题"
        poster="https://pbs.twimg.com/poster.jpg"
        tweetUrl="https://x.com/example/status/2"
        videoUrl="https://video.twimg.com/amplify_video/2/video.mp4"
      />,
    );

    const video = screen.getByLabelText<HTMLVideoElement>("动画 GIF：另一条真实标题");
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.autoplay).toBe(false);
    expect(video.loop).toBe(false);
    expect(video.muted).toBe(true);
  });

  it("keeps the original-source recovery when playback fails", () => {
    render(
      <XVideoPlayer
        isAnimatedGif={false}
        itemTitle="加载失败的条目"
        poster="https://pbs.twimg.com/poster.jpg"
        tweetUrl="https://x.com/example/status/3"
        videoUrl="https://video.twimg.com/amplify_video/3/video.mp4"
      />,
    );

    fireEvent.error(screen.getByLabelText("视频：加载失败的条目"));
    expect(screen.getByRole("status").textContent).toBe("当前浏览器无法加载视频，请在 X 上查看原视频。");
    expect(screen.getByRole("link", { name: "在 X 上查看原视频" }).getAttribute("href")).toBe(
      "https://x.com/example/status/3",
    );
  });
});
