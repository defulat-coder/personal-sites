import "server-only";

import { createHmac } from "node:crypto";
import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import type { AskSource } from "@/lib/ask-types";
import { getFinalAssistantFailure, getFinalAssistantText, resolvePiModelConfig } from "@/lib/pi-runtime.mjs";

const DEFAULT_SESSION_RETENTION_HOURS = 24;
const MAX_SOURCE_CHARACTERS = 2_400;
const askSessionDirectory = path.join(process.cwd(), "var", "ask-sessions");
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

function requiredSessionSecret() {
  const value = process.env.ASK_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("缺少 ASK_SESSION_SECRET（至少 32 个字符）；无法安全创建匿名问答会话。");
  }
  return value;
}

function getSessionId(visitorId: string) {
  return createHmac("sha256", requiredSessionSecret()).update(visitorId).digest("hex");
}

function formatSources(sources: AskSource[]) {
  return sources.map((source, index) => [
    `【${index + 1}】${source.title}${source.section ? ` · ${source.section}` : ""}`,
    source.content.slice(0, MAX_SOURCE_CHARACTERS),
  ].join("\n")).join("\n\n");
}

async function cleanExpiredSessions() {
  await mkdir(askSessionDirectory, { mode: 0o700, recursive: true });
  await chmod(askSessionDirectory, 0o700);
  const now = Date.now();
  const retentionMilliseconds = getSessionRetentionMilliseconds();
  const entries = await readdir(askSessionDirectory, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map(async (entry) => {
      const filePath = path.join(askSessionDirectory, entry.name);
      const metadata = await stat(filePath);
      if (now - metadata.mtimeMs > retentionMilliseconds) {
        await rm(filePath, { force: true });
      }
    }));
}

async function getSessionManager(
  sessionId: string,
  SessionManager: typeof import("@earendil-works/pi-coding-agent").SessionManager,
) {
  await cleanExpiredSessions();
  const sessionSuffix = `_${sessionId}.jsonl`;
  const existing = (await readdir(askSessionDirectory))
    .filter((entry) => entry.endsWith(sessionSuffix))
    .sort()
    .at(-1);

  const manager = existing
    ? SessionManager.open(path.join(askSessionDirectory, existing), askSessionDirectory, process.cwd())
    : SessionManager.create(process.cwd(), askSessionDirectory, { id: sessionId });
  const sessionFile = manager.getSessionFile();
  if (sessionFile) await chmod(sessionFile, 0o600);
  return manager;
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
  onText,
  question,
  signal,
  sources,
  visitorId,
}: {
  onText: (text: string) => void;
  question: string;
  signal?: AbortSignal;
  sources: AskSource[];
  visitorId: string;
}) {
  const sessionId = getSessionId(visitorId);
  return withSessionLock(sessionId, async () => {
    // Pi imports optional Node integrations internally. Keep that code out of
    // static page generation; it is needed only after a real POST request.
    const {
      createAgentSession,
      DefaultResourceLoader,
      getAgentDir,
      ModelRuntime,
      SessionManager,
    } = await import("@earendil-works/pi-coding-agent");
    const modelConfig = resolvePiModelConfig({ env: process.env });
    if (!process.env.KIMI_API_KEY) throw new Error("缺少 KIMI_API_KEY，暂时无法生成回答。");

    const runtime = await ModelRuntime.create({ allowModelNetwork: false });
    const model = runtime.getModel(modelConfig.provider, modelConfig.model);
    if (!model) throw new Error(`Pi 未找到模型：${modelConfig.provider}/${modelConfig.model}`);

    const resourceLoader = new DefaultResourceLoader({
      agentDir: getAgentDir(),
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

    const { session } = await createAgentSession({
      cwd: process.cwd(),
      model,
      modelRuntime: runtime,
      noTools: "all",
      resourceLoader,
      sessionManager: await getSessionManager(sessionId, SessionManager),
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
      session.dispose();
    }
  });
}
