import "server-only";

import { createHmac } from "node:crypto";
import { chmod, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { readPersistableSessionFile } from "@/lib/ask-session-file";
import type { AskSource } from "@/lib/ask-types";
import { getFinalAssistantFailure, getFinalAssistantText, resolvePiModelConfig } from "@/lib/pi-runtime.mjs";

const DEFAULT_SESSION_RETENTION_HOURS = 24;
const MAX_SOURCE_CHARACTERS = 2_400;
const ASK_SESSION_BUCKET = "ask-sessions";
const ASK_RUNTIME_DIRECTORY = "ask-runtime";
const sessionLocks = new Map<string, Promise<void>>();

const askSystemPrompt = `你是“陈远｜每日关注”的公开资料问答助手。只依据每一轮随消息给出的公开资料包回答；不能使用工具、文件、网络、数据库、技能或任何未提供的上下文。使用中文，简洁、准确、可追溯。资料不足、资料互相矛盾或无法确认时，直接说明“现有公开资料不足以确认”，不要猜测。回答中在相关断言后用【来源编号】标注资料包编号。`;

function getSessionRetentionMilliseconds() {
  const configured = process.env.ASK_SESSION_RETENTION_HOURS;
  if (!configured) return DEFAULT_SESSION_RETENTION_HOURS * 60 * 60 * 1_000;
  const hours = Number(configured);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("ASK_SESSION_RETENTION_HOURS 必须是大于 0 的小时数。");
  }
  return hours * 60 * 60 * 1_000;
}

function usesRemoteSessionStorage() {
  return process.env.VERCEL === "1";
}

function getSessionDirectory() {
  return usesRemoteSessionStorage()
    ? path.join(tmpdir(), "ask-sessions")
    : path.join(process.cwd(), "var", "ask-sessions");
}

/**
 * Pi's credential and resource stores are process-local implementation data,
 * not part of an anonymous visitor's persisted conversation. Vercel does not
 * provide a writable home directory, so never let Pi fall back to ~/.pi/agent.
 */
function getRuntimeDirectory() {
  return path.join(tmpdir(), ASK_RUNTIME_DIRECTORY);
}

function getRemoteSessionPath(sessionId: string) {
  return `${sessionId}.jsonl`;
}

function getRestoredSessionFileName(sessionId: string) {
  return `ask_${sessionId}.jsonl`;
}

function requiredStorageEnvironment(key: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；无法持久保存公开问答会话。`);
  return value;
}

function getSessionStorageClient() {
  return createClient(
    requiredStorageEnvironment("SUPABASE_URL"),
    requiredStorageEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function isMissingRemoteSession(error: { message?: string; status?: number; statusCode?: string } | null) {
  return error?.statusCode === "404" && /object not found/i.test(error.message ?? "");
}

async function ensureSessionDirectory() {
  const sessionDirectory = getSessionDirectory();
  await mkdir(/* turbopackIgnore: true */ sessionDirectory, { mode: 0o700, recursive: true });
  await chmod(/* turbopackIgnore: true */ sessionDirectory, 0o700);
  return sessionDirectory;
}

async function ensureRuntimeDirectory() {
  const runtimeDirectory = getRuntimeDirectory();
  await mkdir(/* turbopackIgnore: true */ runtimeDirectory, { mode: 0o700, recursive: true });
  await chmod(/* turbopackIgnore: true */ runtimeDirectory, 0o700);
  return runtimeDirectory;
}

async function restoreRemoteSession(sessionId: string, sessionDirectory: string) {
  if (!usesRemoteSessionStorage()) return;

  const { data, error } = await getSessionStorageClient().storage
    .from(ASK_SESSION_BUCKET)
    .download(getRemoteSessionPath(sessionId));
  if (error) {
    if (isMissingRemoteSession(error)) return;
    throw new Error(`读取公开问答会话失败：${error.message}`);
  }
  if (!data) return;

  const sessionFile = path.join(sessionDirectory, getRestoredSessionFileName(sessionId));
  await writeFile(/* turbopackIgnore: true */ sessionFile, Buffer.from(await data.arrayBuffer()), { mode: 0o600 });
  await chmod(/* turbopackIgnore: true */ sessionFile, 0o600);
}

async function persistRemoteSession(sessionId: string, sessionFile: string | undefined) {
  if (!usesRemoteSessionStorage() || !sessionFile) return;

  const contents = await readPersistableSessionFile(sessionFile);
  if (!contents) return;
  const { error } = await getSessionStorageClient().storage
    .from(ASK_SESSION_BUCKET)
    .upload(getRemoteSessionPath(sessionId), contents, {
      cacheControl: "0",
      contentType: "application/x-ndjson",
      upsert: true,
    });
  if (error) throw new Error(`保存公开问答会话失败：${error.message}`);
}

async function cleanExpiredRemoteSessions() {
  if (!usesRemoteSessionStorage()) return;

  const { data, error } = await getSessionStorageClient().storage
    .from(ASK_SESSION_BUCKET)
    .list("", { limit: 1_000, sortBy: { column: "updated_at", order: "asc" } });
  if (error) throw new Error(`清理公开问答会话失败：${error.message}`);

  const expiresBefore = Date.now() - getSessionRetentionMilliseconds();
  const expiredPaths = (data ?? [])
    .filter((entry) => entry.name.endsWith(".jsonl") && Date.parse(entry.updated_at ?? "") < expiresBefore)
    .map((entry) => entry.name);
  if (expiredPaths.length === 0) return;

  const { error: removeError } = await getSessionStorageClient().storage.from(ASK_SESSION_BUCKET).remove(expiredPaths);
  if (removeError) throw new Error(`删除过期公开问答会话失败：${removeError.message}`);
}

function requiredSessionSecret() {
  const value = process.env.ASK_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("缺少 ASK_SESSION_SECRET（至少 32 个字符）；无法安全创建匿名问答会话。");
  }
  return value;
}

function getSessionId(visitorId: string, conversationId: string) {
  return createHmac("sha256", requiredSessionSecret()).update(`${visitorId}:${conversationId}`).digest("hex");
}

function formatSources(sources: AskSource[]) {
  return sources.map((source, index) => [
    `【${index + 1}】${source.title}${source.section ? ` · ${source.section}` : ""}`,
    source.content.slice(0, MAX_SOURCE_CHARACTERS),
  ].join("\n")).join("\n\n");
}

async function cleanExpiredSessions() {
  const sessionDirectory = await ensureSessionDirectory();
  const now = Date.now();
  const retentionMilliseconds = getSessionRetentionMilliseconds();
  const entries = await readdir(/* turbopackIgnore: true */ sessionDirectory, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map(async (entry) => {
      const filePath = path.join(/* turbopackIgnore: true */ sessionDirectory, entry.name);
      const metadata = await stat(/* turbopackIgnore: true */ filePath);
      if (now - metadata.mtimeMs > retentionMilliseconds) {
        await rm(/* turbopackIgnore: true */ filePath, { force: true });
      }
    }));
  await cleanExpiredRemoteSessions();
  return sessionDirectory;
}

async function getSessionManager(
  sessionId: string,
  SessionManager: typeof import("@earendil-works/pi-coding-agent").SessionManager,
) {
  const sessionDirectory = await cleanExpiredSessions();
  await restoreRemoteSession(sessionId, sessionDirectory);
  const sessionSuffix = `_${sessionId}.jsonl`;
  const existing = (await readdir(/* turbopackIgnore: true */ sessionDirectory))
    .filter((entry) => entry.endsWith(sessionSuffix))
    .sort()
    .at(-1);

  const manager = existing
    ? SessionManager.open(path.join(/* turbopackIgnore: true */ sessionDirectory, existing), sessionDirectory, process.cwd())
    : SessionManager.create(process.cwd(), sessionDirectory, { id: sessionId });
  await secureSessionFile(manager.getSessionFile());
  return manager;
}

async function secureSessionFile(sessionFile: string | undefined) {
  if (!sessionFile) return;
  try {
    await chmod(/* turbopackIgnore: true */ sessionFile, 0o600);
  } catch (error) {
    // Pi allocates a new session path before its first message creates the file.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

async function withSessionLock<T>(sessionId: string, operation: () => Promise<T>) {
  const previous = sessionLocks.get(sessionId) ?? Promise.resolve();
  let releaseCurrent: (() => void) | undefined;
  const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
  const tail = previous.catch(() => undefined).then(() => current);
  sessionLocks.set(sessionId, tail);
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    releaseCurrent?.();
    void tail.finally(() => {
      if (sessionLocks.get(sessionId) === tail) sessionLocks.delete(sessionId);
    });
  }
}

export async function streamAskAnswer({
  conversationId,
  onText,
  question,
  signal,
  sources,
  visitorId,
}: {
  conversationId: string;
  onText: (text: string) => void;
  question: string;
  signal?: AbortSignal;
  sources: AskSource[];
  visitorId: string;
}) {
  const sessionId = getSessionId(visitorId, conversationId);
  return withSessionLock(sessionId, async () => {
    // Pi imports optional Node integrations internally. Keep that code out of
    // static page generation; it is needed only after a real POST request.
    const {
      createAgentSession,
      DefaultResourceLoader,
      ModelRuntime,
      SessionManager,
    } = await import("@earendil-works/pi-coding-agent");
    const modelConfig = resolvePiModelConfig({ env: process.env });
    const kimiApiKey = process.env.KIMI_API_KEY;
    if (!kimiApiKey) throw new Error("缺少 KIMI_API_KEY，暂时无法生成回答。");

    const runtimeDirectory = await ensureRuntimeDirectory();
    const runtime = await ModelRuntime.create({
      allowModelNetwork: false,
      authPath: path.join(runtimeDirectory, "auth.json"),
      modelsPath: null,
    });
    await runtime.setRuntimeApiKey(modelConfig.provider, kimiApiKey);
    const model = runtime.getModel(modelConfig.provider, modelConfig.model);
    if (!model) throw new Error(`Pi 未找到模型：${modelConfig.provider}/${modelConfig.model}`);

    const resourceLoader = new DefaultResourceLoader({
      agentDir: runtimeDirectory,
      appendSystemPromptOverride: () => [],
      cwd: process.cwd(),
      noContextFiles: true,
      noExtensions: true,
      noPromptTemplates: true,
      noSkills: true,
      noThemes: true,
      systemPromptOverride: () => askSystemPrompt,
    });
    await resourceLoader.reload();

    const sessionManager = await getSessionManager(sessionId, SessionManager);
    const { session } = await createAgentSession({
      agentDir: runtimeDirectory,
      cwd: process.cwd(),
      model,
      modelRuntime: runtime,
      noTools: "all",
      resourceLoader,
      sessionManager,
      thinkingLevel: "off",
    });
    const abortSession = () => { void session.abort(); };
    signal?.addEventListener("abort", abortSession, { once: true });
    if (signal?.aborted) abortSession();
    let streamedText = "";
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        streamedText += event.assistantMessageEvent.delta;
        onText(event.assistantMessageEvent.delta);
      }
    });

    try {
      await session.prompt(`本轮问题：${question}\n\n本轮公开资料包：\n${formatSources(sources)}\n\n请只根据本轮资料包回答，并使用资料编号标注依据。`);
      const failure = getFinalAssistantFailure(session);
      if (failure) throw new Error(failure);
      const finalText = getFinalAssistantText(session);
      if (finalText && finalText !== streamedText) {
        onText(finalText.startsWith(streamedText) ? finalText.slice(streamedText.length) : finalText);
      }
    } finally {
      signal?.removeEventListener("abort", abortSession);
      unsubscribe();
      try {
        await secureSessionFile(sessionManager.getSessionFile());
        try {
          await persistRemoteSession(sessionId, sessionManager.getSessionFile());
        } catch (error) {
          // The generated reply is still valid if its next-turn context cannot
          // be saved. Never replace it with a generic streaming error.
          console.error("Public ask session persistence failed", error);
        }
      } finally {
        session.dispose();
      }
    }
  });
}
