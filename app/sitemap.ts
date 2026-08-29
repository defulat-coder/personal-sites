import type { MetadataRoute } from "next";

import { getSitemapRecords } from "@/lib/discovery.server";
import { SITE_URL } from "@/lib/site";

const staticPaths = ["", "/ai-news", "/curation", "/design", "/douyin", "/open-source", "/works", "/ask"];

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamic = await getSitemapRecords();
  return [
    ...staticPaths.map((path, index) => ({
      changeFrequency: path === "" ? "daily" as const : "hourly" as const,
      priority: path === "" ? 1 : index <= 2 ? 0.9 : 0.7,
      url: `${SITE_URL}${path}`,
    })),
    ...dynamic.map((item) => ({
      changeFrequency: "weekly" as const,
      ...(item.lastModified ? { lastModified: item.lastModified } : {}),
      priority: 0.6,
      url: item.url,
    })),
  ];
}
