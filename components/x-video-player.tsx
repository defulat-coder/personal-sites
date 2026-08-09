"use client";

import { useRef, useState } from "react";

import { XAppLink } from "@/components/x-app-link";

type XVideoPlayerProps = {
  isAnimatedGif: boolean;
  poster: string;
  tweetUrl: string;
  videoUrl: string;
};

/** 显式播放按钮确保移动端与嵌入式浏览器在用户手势中启动视频。 */
export function XVideoPlayer({ isAnimatedGif, poster, tweetUrl, videoUrl }: XVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const proxiedVideoUrl = `/api/x-media?url=${encodeURIComponent(videoUrl)}`;

  async function startPlayback() {
    try {
      await videoRef.current?.play();
      setPlaybackError(null);
    } catch {
      setPlaybackError("当前浏览器无法加载视频，请在 X 上查看原视频。");
    }
  }

  return (
    <figure className="curation-detail__media-player">
      <video
        autoPlay={isAnimatedGif}
        controls
        loop={isAnimatedGif}
        muted={isAnimatedGif}
        onError={() => setPlaybackError("当前浏览器无法加载视频，请在 X 上查看原视频。")}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        playsInline
        poster={poster}
        preload="metadata"
        ref={videoRef}
      >
        <source src={proxiedVideoUrl} type="video/mp4" />
        你的浏览器不支持视频播放。请在 X 上查看原视频。
      </video>
      <figcaption>
        <button onClick={() => void startPlayback()} type="button">
          {isPlaying ? "正在播放" : "播放视频"}
        </button>
        <XAppLink href={tweetUrl}>在 X 上查看原视频</XAppLink>
        {playbackError ? <span role="status">{playbackError}</span> : null}
      </figcaption>
    </figure>
  );
}
