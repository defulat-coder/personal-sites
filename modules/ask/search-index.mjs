import { createMarkdownHeadingId } from "../../lib/markdown-anchor.mjs";

const MAX_CHUNK_CHARACTERS = 6_000;

function compactText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function joinSearchText(parts) {
  return parts.map(compactText).filter(Boolean).join("\n\n");
}

function splitAtParagraphs(markdown, maximumLength = MAX_CHUNK_CHARACTERS) {
  const text = compactText(markdown);
  if (!text || text.length <= maximumLength) return text ? [text] : [];

  const chunks = [];
  let remaining = text;
  while (remaining.length > maximumLength) {
    const boundary = remaining.lastIndexOf("\n\n", maximumLength);
    const end = boundary > maximumLength / 2 ? boundary : maximumLength;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).replace(/^\n+/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * Split published Markdown at headings first, then at paragraph boundaries.
 * The heading stays on every resulting chunk so citation context is stable.
 */
export function splitReadmeByHeading(markdown) {
  const sections = [];
  let heading = "概览";
  let anchor = null;
  let lines = [];
  const headingIds = new Map();

  const pushSection = () => {
    const body = compactText(lines.join("\n"));
    if (!body) return;
    for (const [index, chunk] of splitAtParagraphs(body).entries()) {
      sections.push({
        anchor,
        content: chunk,
        heading,
        part: index + 1,
      });
    }
  };

  for (const line of String(markdown ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      pushSection();
      heading = compactText(match[2]) || "概览";
      anchor = createMarkdownHeadingId(heading, headingIds);
      lines = [line];
      continue;
    }
    lines.push(line);
  }
  pushSection();
  return sections;
}

export function toDailySearchDocuments(rows) {
  return rows.flatMap((row) => {
    const item = row?.content;
    if (!item?.id || !item.title || !item.summary) return [];
    const content = joinSearchText([
      item.summary,
      item.analysis,
      item.text,
      item.quoteContext?.text,
    ]);
    const searchText = joinSearchText([
      item.title,
      item.tags?.join(" "),
      item.author?.name,
      item.author?.handle,
      content,
    ]);
    if (!content || !searchText) return [];
    return [{
      content,
      id: `daily:${item.id}`,
      published_at: item.publishedAt ?? row.published_at ?? null,
      search_text: searchText,
      section: null,
      source_id: item.id,
      source_scope: "daily",
      source_url: `/curation/${encodeURIComponent(item.id)}`,
      title: item.title,
    }];
  });
}

export function toOpenSourceSearchDocuments(rows) {
  return rows.flatMap((row) => {
    const item = row?.content;
    if (!item?.slug || !item.repository || !item.parsedMarkdown) return [];

    return splitReadmeByHeading(item.parsedMarkdown).map((chunk, index) => {
      const section = chunk.part > 1 ? `${chunk.heading}（${chunk.part}）` : chunk.heading;
      const content = joinSearchText([item.sourceSummary, item.personalNote, chunk.content]);
      return {
        content,
        id: `open-source:${item.slug}:${index + 1}`,
        published_at: row.published_at ?? null,
        search_text: joinSearchText([
          item.repository,
          item.category,
          item.type,
          item.dimensions?.join(" "),
          section,
          content,
        ]),
        section,
        source_id: row.repo_node_id ?? item.slug,
        source_scope: "open-source",
        source_url: `/open-source/${encodeURIComponent(item.slug)}${chunk.anchor ? `#${chunk.anchor}` : ""}`,
        title: item.repository,
      };
    });
  });
}

export function toAiNewsSearchDocuments(rows) {
  return rows.flatMap((row) => {
    const item = row?.content;
    if (!item?.id || !item.title || !item.summary) return [];
    const content = joinSearchText([item.summary, item.reason]);
    const searchText = joinSearchText([
      item.title,
      item.category,
      item.sourceName,
      content,
    ]);
    if (!content || !searchText) return [];
    return [{
      content,
      id: `ai-news:${item.id}`,
      published_at: item.publishedAt ?? row.published_at ?? null,
      search_text: searchText,
      section: null,
      source_id: item.id,
      source_scope: "ai-news",
      source_url: `/ai-news/${encodeURIComponent(item.id)}`,
      title: item.title,
    }];
  });
}

export async function syncAskSearchDocuments(client, scope, documents, { replaceScope = false } = {}) {
  const { data, error } = await client.rpc("sync_ask_search_documents", {
    p_documents: documents,
    p_replace_scope: replaceScope,
    p_scope: scope,
  });
  if (error) throw new Error(`更新公开问答全文索引失败：${error.message}`);
  return Number(data ?? 0);
}

export async function deleteAskSearchDocuments(client, scope, sourceIds) {
  if (sourceIds.length === 0) return 0;
  const { data, error } = await client.rpc("delete_ask_search_documents", {
    p_scope: scope,
    p_source_ids: sourceIds,
  });
  if (error) throw new Error(`删除已撤回公开问答全文索引失败：${error.message}`);
  return Number(data ?? 0);
}
