export type CurationLink = {
  shortUrl: string | null;
  type: string;
  url: string;
};

export type CurationItem = {
  analysis: string;
  author: { handle: string; name: string };
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
