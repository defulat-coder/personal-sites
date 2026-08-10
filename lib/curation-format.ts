import type { CurationListItem } from "@/lib/curation-types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(value));
}

export function formatCurationDate(item: Pick<CurationListItem, "collectedAt" | "publishedAt">) {
  if (item.collectedAt) return `${formatDate(item.collectedAt)} 收录`;
  if (item.publishedAt) return `${formatDate(item.publishedAt)} 发布`;
  return "日期待定";
}

export function formatOriginalPublicationDate(item: Pick<CurationListItem, "publishedAt">) {
  return item.publishedAt ? formatDate(item.publishedAt) : "日期待定";
}
