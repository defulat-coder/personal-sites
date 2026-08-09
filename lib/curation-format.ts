import type { CurationListItem } from "@/lib/curation-types";

export function formatCurationDate(item: Pick<CurationListItem, "publishedAt">) {
  if (!item.publishedAt) return "日期待定";
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(item.publishedAt));
}
