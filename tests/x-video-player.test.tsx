/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { XVideoPlayer } from "../components/x-video-player";

afterEach(() => vi.restoreAllMocks());

describe("XVideoPlayer", () => {
  it("starts playback from its explicit user-action button", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(
      <XVideoPlayer
        isAnimatedGif={false}
        poster="https://pbs.twimg.com/media/preview.jpg"
        tweetUrl="https://x.com/author/status/1"
        videoUrl="https://video.twimg.com/video.mp4"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "播放视频" }));

    expect(play).toHaveBeenCalledOnce();
  });
});
