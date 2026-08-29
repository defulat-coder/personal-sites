import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { XVideoPlayer } from "@/components/x-video-player";

describe("XVideoPlayer", () => {
  it("does not preload ordinary videos before the visitor presses play", () => {
    const { container } = render(
      <XVideoPlayer
        isAnimatedGif={false}
        poster="https://pbs.twimg.com/poster.jpg"
        tweetUrl="https://x.com/example/status/1"
        videoUrl="https://video.twimg.com/amplify_video/1/video.mp4"
      />,
    );

    expect(container.querySelector("video")?.getAttribute("preload")).toBe("none");
  });
});
