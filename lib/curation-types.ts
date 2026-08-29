export type CurationLink = {
  shortUrl: string | null;
  type: string;
  url: string;
};

export type CurationSource = {
  label: string;
  platform: "douyin" | "x";
  url: string;
};

export type DesignClassification = {
  categories: string[];
  classifiedAt: string;
  confidence: number;
  evidence: string[];
  reason: string;
  relevant: boolean;
  status: "include" | "review" | "exclude";
};

export type CurationMedia = {
  durationMs: number | null;
  height: number | null;
  previewUrl: string | null;
  type: "photo" | "video" | "animated_gif";
  url: string;
  videoUrl: string | null;
  width: number | null;
};

export type CurationFacts = {
  version: number;
  contentType: "original" | "quote" | "reply";
  domains: string[];
  hashtags: string[];
  linkTypes: string[];
  mediaTypes: string[];
  mentions: string[];
  sourceKinds: string[];
  tools: string[];
};

export type CurationSearchSignals = {
  concepts: string[];
  entities: string[];
  problems: string[];
  sentiment: "positive" | "negative" | "neutral" | "humorous" | "controversial";
  tools: string[];
  useCases: string[];
};

export type CurationVisualFacts = {
  interactionSignals: string[];
  objects: string[];
  ocr: string[];
  scenes: string[];
  styles: string[];
  tools: string[];
};

export type CurationItem = {
  analysis: string;
  author: { handle: string; name: string };
  collectedAt: string | null;
  collectedOrder: number | null;
  design: DesignClassification | null;
  facts: CurationFacts;
  id: string;
  links: CurationLink[];
  media: CurationMedia[];
  publishedAt: string | null;
  quoteContext: { author: string; authorName: string; text: string } | null;
  source: CurationSource;
  searchSignals: CurationSearchSignals | null;
  summary: string;
  tags: string[];
  text: string;
  title: string;
  visualFacts: CurationVisualFacts | null;
};

/**
 * Fields needed by the feed; the full analysis remains detail-only.
 * 剪报簿结构在列表里同时呈现判断（title/summary）与证据（text 摘录、tags、attachments），
 * attachments 由投影在读取时从 media 与 quoteContext 归并成登记用词。
 */
export type CurationListItem = Pick<
  CurationItem,
  "author" | "collectedAt" | "design" | "id" | "media" | "publishedAt" | "source" | "summary" | "tags" | "text" | "title"
> & {
  attachments: string[];
};
