"use client";

import { useState } from "react";

import { XAppLink } from "@/components/x-app-link";

type XVideoPlayerProps = {
  isAnimatedGif: boolean;
  poster: string;
  tweetUrl: string;
  videoUrl: string;
};

/** 原生控制条播放；加载失败时保留 X 原视频回退入口。 */
export function XVideoPlayer({ isAnimatedGif, poster, tweetUrl, videoUrl }: XVideoPlayerProps) {
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const proxiedVideoUrl = `/api/x-media?url=${encodeURIComponent(videoUrl)}`;

  return (
    <figure className="curation-detail__media-player">
      <video
        autoPlay={isAnimatedGif}
        controls
        loop={isAnimatedGif}
        muted={isAnimatedGif}
        onError={() => setPlaybackError("当前浏览器无法加载视频，请在 X 上查看原视频。")}
        playsInline
        poster={poster}
        preload="metadata"
      >
        <source src={proxiedVideoUrl} type="video/mp4" />
        你的浏览器不支持视频播放。请在 X 上查看原视频。
      </video>
      <figcaption>
        <XAppLink href={tweetUrl}>在 X 上查看原视频</XAppLink>
        {playbackError ? <span role="status">{playbackError}</span> : null}
      </figcaption>
    </figure>
  );
}
