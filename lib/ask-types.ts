export const askScopes = ["all", "profile", "works", "ai-news", "daily", "open-source"] as const;

export type AskScope = (typeof askScopes)[number];
export type AskDocumentScope = Exclude<AskScope, "all">;

export type AskSource = {
  content: string;
  id: string;
  publishedAt: string | null;
  scope: AskDocumentScope;
  section: string | null;
  sourceId: string;
  sourceUrl: string;
  title: string;
};
