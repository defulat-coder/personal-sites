export type CurationLink = {
  shortUrl: string | null;
  type: string;
  url: string;
};

export type CurationItem = {
  analysis: string;
  author: { handle: string; name: string };
  collectedAt: string | null;
  collectedOrder: number | null;
  id: string;
  links: CurationLink[];
  media: Array<{
    durationMs: number | null;
    height: number | null;
    previewUrl: string | null;
    type: "photo" | "video" | "animated_gif";
    url: string;
    videoUrl: string | null;
    width: number | null;
  }>;
  publishedAt: string | null;
  quoteContext: { author: string; authorName: string; text: string } | null;
  summary: string;
  tags: string[];
  text: string;
  title: string;
  tweetUrl: string;
};

/**
 * Fields needed by the feed; the full analysis remains detail-only.
 * 剪报簿结构在列表里同时呈现判断（title/summary）与证据（text 摘录、tags、attachments），
 * attachments 由投影在读取时从 media 与 quoteContext 归并成登记用词。
 */
export type CurationListItem = Pick<
  CurationItem,
  "author" | "collectedAt" | "id" | "publishedAt" | "summary" | "tags" | "text" | "title"
> & {
  attachments: string[];
};
