import { z } from "zod";

import { checkAskRateLimit } from "@/lib/ask-limiter.server";
import { searchAskDocuments } from "@/lib/ask-search.server";
import { streamAskAnswer } from "@/lib/ask-session.server";
import { askScopes } from "@/lib/ask-types";

const requestSchema = z.object({
  question: z.string().trim().min(2).max(1_000),
  scope: z.enum(askScopes),
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/, "浏览器会话标识无效。"),
});

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "问题、范围或浏览器会话标识无效。" }, { status: 400 });

  const limit = checkAskRateLimit(getClientIp(request));
  if (!limit.allowed) {
    return Response.json(
      { error: "提问过于频繁，请稍后再试。" },
      { headers: { "Retry-After": String(limit.retryAfterSeconds) }, status: 429 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      try {
        const sources = await searchAskDocuments(parsed.data.question, parsed.data.scope);
        write("sources", { sources });
        if (sources.length === 0) {
          write("text", { delta: "现有公开资料不足以确认这个问题。你可以换一个更具体的关键词，或切换检索范围后再试。" });
          write("done", {});
          return;
        }

        await streamAskAnswer({
          onText: (delta) => write("text", { delta }),
          question: parsed.data.question,
          signal: request.signal,
          sources,
          visitorId: parsed.data.visitorId,
        });
        write("done", {});
      } catch (error) {
        if (request.signal.aborted) return;
        console.error("Public ask request failed", error);
        write("error", { message: "回答暂时不可用，请稍后重试。" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
