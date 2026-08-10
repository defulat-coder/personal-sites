import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { AskScope, AskSource } from "@/lib/ask-types";

const searchResultSchema = z.object({
  content: z.string().min(1),
  id: z.string().min(1),
  published_at: z.string().datetime().nullable(),
  score: z.number(),
  section: z.string().nullable(),
  source_id: z.string().min(1),
  source_scope: z.enum(["daily", "open-source"]),
  source_url: z.string().min(1),
  title: z.string().min(1),
});

function requiredEnvironment(key: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；公开问答无法读取服务端全文索引。`);
  return value;
}

function getAskSearchClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Reads the server-only PGroonga index; it is never exposed as a browser RPC. */
export async function searchAskDocuments(query: string, scope: AskScope): Promise<AskSource[]> {
  const { data, error } = await getAskSearchClient().rpc("search_ask_documents", {
    p_limit: 6,
    p_query: query,
    p_scope: scope === "all" ? null : scope,
  });
  if (error) throw new Error(`检索公开问答资料失败：${error.message}`);

  return z.array(searchResultSchema).parse(data ?? []).map((document) => ({
    content: document.content,
    id: document.id,
    publishedAt: document.published_at,
    scope: document.source_scope,
    section: document.section,
    sourceId: document.source_id,
    sourceUrl: document.source_url,
    title: document.title,
  }));
}
