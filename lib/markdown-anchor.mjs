/**
 * Stable heading ids shared by indexed README citations and the rendered
 * public Markdown. They intentionally favour readable Chinese/Latin slugs.
 */
export function createMarkdownHeadingId(value, used = new Map()) {
  const base = String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "section";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}
