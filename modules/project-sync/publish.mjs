import { createClient } from "@supabase/supabase-js";

import { approvedProjectSchema, publicProjectSnapshotSchema } from "./schema.mjs";
import { assertPublicContentSafe, canonicalJson, readJson, sha256, writePrivateJson } from "./source.mjs";

function requiredEnvironment(env, key) {
  const value = env[key];
  if (!value) throw new Error(`缺少 ${key}，无法发布项目公开快照。`);
  return value;
}

export function assertPublicSnapshotSafe(snapshot) {
  return assertPublicContentSafe(snapshot);
}

export function buildPublicProjectSnapshot(project, approved) {
  const parsed = approvedProjectSchema.parse(approved);
  const snapshot = publicProjectSnapshotSchema.parse({
    ...(parsed.bodyMarkdown ? { bodyMarkdown: parsed.bodyMarkdown } : {}),
    currentFocus: parsed.currentFocus,
    period: project.period,
    projectId: project.id,
    records: parsed.records,
    ...(project.repo ? { repo: project.repo } : {}),
    role: project.role,
    shots: project.shots,
    slug: project.slug,
    sourceObservedAt: parsed.sourceObservedAt,
    stack: project.stack,
    status: project.status,
    summary: parsed.summary,
    title: project.title,
    ...(project.url ? { url: project.url } : {}),
    version: 1,
  });
  assertPublicSnapshotSafe(snapshot);
  return { revision: sha256(canonicalJson(snapshot)), snapshot };
}

export async function publishApprovedProject({ clientFactory = createClient, env = process.env, now = new Date(), paths, project }) {
  const approved = approvedProjectSchema.parse(await readJson(paths.approved));
  const { revision, snapshot } = buildPublicProjectSnapshot(project, approved);
  const client = clientFactory(
    requiredEnvironment(env, "SUPABASE_URL"),
    requiredEnvironment(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const publishedAt = now.toISOString();
  const row = {
    display_order: project.order,
    period: project.period,
    project_id: project.id,
    published_at: publishedAt,
    revision,
    slug: project.slug,
    snapshot,
    source_observed_at: snapshot.sourceObservedAt,
    status: project.status,
    summary: snapshot.summary,
    synced_at: publishedAt,
    title: project.title,
  };
  const { error: writeError } = await client
    .from("project_public_snapshots")
    .upsert(row, { onConflict: "project_id" });
  if (writeError) throw new Error(`发布 ${project.id} 项目快照失败：${writeError.message}`);
  const { data, error: readError } = await client
    .from("project_public_snapshots")
    .select("project_id,revision,snapshot")
    .eq("project_id", project.id)
    .single();
  if (readError) throw new Error(`回读 ${project.id} 项目快照失败：${readError.message}`);
  if (data.project_id !== project.id || data.revision !== revision) {
    throw new Error(`${project.id} 项目快照回读修订不一致。`);
  }
  publicProjectSnapshotSchema.parse(data.snapshot);
  const state = (await readJson(paths.state)) ?? {};
  await writePrivateJson(paths.state, { ...state, publishedAt, publishedRevision: revision });
  return { publishedAt, recordCount: snapshot.records.length, revision, snapshot };
}
