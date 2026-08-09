function mediaKey(media) {
  return `${media.type ?? "photo"}:${media.url ?? ""}`;
}

/** 保留播放器所需的直连 MP4 与时长，其他媒体仍按原样展示。 */
export function normalizeXMedia(media) {
  return {
    type: media.type ?? "photo",
    url: media.url ?? null,
    previewUrl: media.previewUrl ?? null,
    videoUrl: media.videoUrl ?? null,
    durationMs: typeof media.durationMs === "number" ? media.durationMs : null,
    width: media.width ?? null,
    height: media.height ?? null,
  };
}

/** 增量同步不会覆盖已有媒体；新发现的视频地址会补充进同一条媒体记录。 */
export function mergeXMedia(existing = [], incoming = []) {
  const normalizedIncoming = incoming.map(normalizeXMedia);
  const incomingByKey = new Map(normalizedIncoming.map((media) => [mediaKey(media), media]));
  const merged = existing.map((media) => {
    const next = incomingByKey.get(mediaKey(media));
    return next
      ? {
          type: next.type ?? media.type ?? "photo",
          url: next.url ?? media.url ?? null,
          previewUrl: next.previewUrl ?? media.previewUrl ?? null,
          videoUrl: next.videoUrl ?? media.videoUrl ?? null,
          durationMs: next.durationMs ?? media.durationMs ?? null,
          width: next.width ?? media.width ?? null,
          height: next.height ?? media.height ?? null,
        }
      : media;
  });
  const existingKeys = new Set(existing.map(mediaKey));
  return [...merged, ...normalizedIncoming.filter((media) => !existingKeys.has(mediaKey(media)))];
}
