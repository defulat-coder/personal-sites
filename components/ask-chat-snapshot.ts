import { z } from "zod";

import { askScopes, type AskSource } from "@/lib/ask-types";

const sourceSchema: z.ZodType<AskSource> = z.object({
  content: z.string(),
  id: z.string(),
  publishedAt: z.string().nullable(),
  scope: z.enum(["profile", "works", "ai-news", "daily", "open-source"]),
  section: z.string().nullable(),
  sourceId: z.string(),
  sourceUrl: z.string(),
  title: z.string(),
});

const messageSchema = z.object({
  citations: z.array(sourceSchema),
  content: z.string(),
  id: z.string(),
  isComplete: z.boolean(),
  role: z.enum(["assistant", "user"]),
  scope: z.enum(askScopes).optional(),
  interruption: z.object({
    kind: z.enum(["stopped", "error"]),
    message: z.string(),
  }).optional(),
});

export type ChatMessage = z.infer<typeof messageSchema>;

const snapshotSchema = z.object({
  messages: z.array(messageSchema),
  question: z.string(),
  scope: z.enum(askScopes),
});

export type AskChatSnapshot = z.infer<typeof snapshotSchema>;
export const ASK_CHAT_STORAGE_KEY = "personal-site:ask-chat";

export function readAskChatSnapshot(): AskChatSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY);
    return raw ? snapshotSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeAskChatSnapshot(snapshot: AskChatSnapshot) {
  try {
    if (!snapshot.messages.length && !snapshot.question && snapshot.scope === "all") {
      window.sessionStorage.removeItem(ASK_CHAT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
      ...snapshot,
      // 快照不是后台生成任务；离开页面后回来，已有部分正文可读且不再显示转圈。
      messages: snapshot.messages.map((message) => message.isComplete ? message : {
        ...message,
        isComplete: true,
        interruption: { kind: "stopped", message: "已停止生成。" },
      }),
    }));
  } catch {
    // 存储被禁用或配额已满时，当前页面仍可继续提问。
  }
}
