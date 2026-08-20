import { z } from "zod";

import { checkAskRateLimit } from "@/lib/ask-limiter.server";
import { searchAskDocuments } from "@/lib/ask-search.server";
import { streamAskAnswer } from "@/lib/ask-session.server";
import { askScopes } from "@/lib/ask-types";

const sessionSchema = z.object({
  conversationId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/, "会话标识无效。"),
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/, "浏览器会话标识无效。"),
});

const requestSchema = sessionSchema.extend({
  question: z.string().trim().min(2).max(1_000),
  scope: z.enum(askScopes),
});

// x-real-ip 由平台边缘按真实连接对端写入，客户端无法伪造；
// x-forwarded-for 的链首是请求方可以自行注入的部分，只取链尾（边缘追加的真实 IP）。
function getClientIp(request: Request) {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "local";
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  // 限流只依赖 IP，提到请求体解析之前，被限的请求不必先读完整 body。
  const limit = checkAskRateLimit(getClientIp(request));
  if (!limit.allowed) {
    return Response.json(
      { error: "提问过于频繁，请稍后再试。" },
      { headers: { "Retry-After": String(limit.retryAfterSeconds) }, status: 429 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "问题、范围或浏览器会话标识无效。" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      try {
        const sources = await searchAskDocuments(parsed.data.question, parsed.data.scope);
        write("sources", { sources });
        if (sources.length === 0) {
          const message = "现有公开资料不足以确认这个问题。你可以换一个更具体的关键词，或切换检索范围后再试。";
          write("text", { delta: message });
          write("done", {});
          return;
        }

        await streamAskAnswer({
          conversationId: parsed.data.conversationId,
          onText: (delta) => write("text", { delta }),
          question: parsed.data.question,
          // 客户端断连即中止生成，不再为已离开的访客烧 token。
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
