"use client";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { AskScope, AskSource } from "@/lib/ask-types";
import { SendHorizontal, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  citations: AskSource[];
  content: string;
  id: string;
  role: "assistant" | "user";
};

const scopeLabels: Record<AskScope, string> = {
  all: "全部",
  daily: "每日关注",
  "open-source": "开源 README",
};

function parseEvents(buffer: string) {
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() ?? "";
  const events = chunks.flatMap((chunk) => {
    const event = /^event:\s*(.+)$/m.exec(chunk)?.[1];
    const data = /^data:\s*(.+)$/m.exec(chunk)?.[1];
    if (!event || !data) return [];
    try {
      return [{ data: JSON.parse(data) as Record<string, unknown>, event }];
    } catch {
      return [];
    }
  });
  return { events, remainder };
}

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<AskScope>("all");
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { default: FingerprintJS } = await import("@fingerprintjs/fingerprintjs");
        const agent = await FingerprintJS.load();
        const result = await agent.get();
        if (active) setVisitorId(result.visitorId);
      } catch {
        if (active) setVisitorId("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  const updateAssistant = (id: string, update: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => message.id === id ? update(message) : message));
  };

  const submit = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isStreaming || !visitorId || visitorId === "unavailable") return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setQuestion("");
    setIsStreaming(true);
    const controller = new AbortController();
    requestController.current = controller;
    setMessages((current) => [...current,
      { citations: [], content: trimmedQuestion, id: userId, role: "user" },
      { citations: [], content: "", id: assistantId, role: "assistant" },
    ]);

    try {
      const response = await fetch("/api/ask", {
        body: JSON.stringify({ question: trimmedQuestion, scope, visitorId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new Error(typeof payload?.error === "string" ? payload.error : "回答暂时不可用，请稍后重试。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const parsed = parseEvents(buffer);
        buffer = parsed.remainder;
        for (const item of parsed.events) {
          if (item.event === "sources" && Array.isArray(item.data.sources)) {
            updateAssistant(assistantId, (message) => ({ ...message, citations: item.data.sources as AskSource[] }));
          }
          if (item.event === "text" && typeof item.data.delta === "string") {
            updateAssistant(assistantId, (message) => ({ ...message, content: `${message.content}${item.data.delta}` }));
          }
          if (item.event === "error") {
            updateAssistant(assistantId, (message) => ({
              ...message,
              content: typeof item.data.message === "string" ? item.data.message : "回答暂时不可用，请稍后重试。",
            }));
          }
        }
        if (done) break;
      }
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "已停止生成。"
        : error instanceof Error ? error.message : "回答暂时不可用，请稍后重试。";
      updateAssistant(assistantId, (current) => ({ ...current, content: message }));
    } finally {
      requestController.current = null;
      setIsStreaming(false);
    }
  };

  const canSubmit = Boolean(question.trim() && visitorId && visitorId !== "unavailable" && !isStreaming);

  return (
    <section aria-labelledby="ask-title" className="ask-chat">
      <header className="ask-chat__header">
        <div>
          <p className="ask-chat__eyebrow">PUBLIC SOURCES ONLY</p>
          <h2 id="ask-title">问一问</h2>
          <p>只基于本站已公开的每日关注与开源 README 回答，并附上实际来源。</p>
        </div>
        <ToggleGroup
          aria-label="检索范围"
          className="ask-chat__scope"
          onValueChange={(value) => {
            if (value === "all" || value === "daily" || value === "open-source") setScope(value);
          }}
          size="sm"
          spacing={0}
          type="single"
          value={scope}
          variant="outline"
        >
          {(Object.keys(scopeLabels) as AskScope[]).map((item) => (
            <ToggleGroupItem key={item} value={item}>{scopeLabels[item]}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>

      <MessageScrollerProvider autoScroll={!prefersReducedMotion} defaultScrollPosition="end">
        <MessageScroller className="ask-chat__scroller">
          <MessageScrollerViewport aria-label="问答记录" className="ask-chat__viewport">
            <MessageScrollerContent className="ask-chat__messages">
              {messages.length === 0 ? (
                <div className="ask-chat__empty">
                  <p>例如：最近有哪些关于 Agent 长期运行的实践？</p>
                </div>
              ) : null}
              {messages.map((message, index) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={isStreaming && index === messages.length - 1}
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <MessageHeader>{message.role === "user" ? "你" : "问答"}</MessageHeader>
                      <MessageGroup>
                        <div
                          aria-live={message.role === "assistant" ? "polite" : undefined}
                          className={cn("ask-chat__bubble", `ask-chat__bubble--${message.role}`)}
                        >
                          {message.content || (isStreaming ? "正在整理公开资料…" : "")}
                        </div>
                      </MessageGroup>
                      {message.role === "assistant" && message.citations.length > 0 ? (
                        <MessageFooter>
                          <ol aria-label="回答来源" className="ask-chat__citations">
                            {message.citations.map((source, sourceIndex) => (
                              <li key={source.id}>
                                <a href={source.sourceUrl}>
                                  【{sourceIndex + 1}】{source.title}{source.section ? ` · ${source.section}` : ""}
                                </a>
                              </li>
                            ))}
                          </ol>
                        </MessageFooter>
                      ) : null}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton aria-label="回到最新消息" />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        className="ask-chat__form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <InputGroup className="ask-chat__composer">
          <InputGroupTextarea
            aria-label="输入问题"
            disabled={!visitorId || visitorId === "unavailable" || isStreaming}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={visitorId === "unavailable" ? "无法建立浏览器会话，请刷新后重试" : visitorId ? "问问这些公开资料…" : "正在建立本次会话…"}
            rows={2}
            value={question}
          />
          <InputGroupAddon align="block-end" className="ask-chat__composer-footer">
            <span>仅检索公开资料 · {scopeLabels[scope]}</span>
            {isStreaming ? (
              <InputGroupButton
                aria-label="停止生成"
                onClick={() => requestController.current?.abort()}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Square aria-hidden="true" />
              </InputGroupButton>
            ) : (
              <InputGroupButton aria-label="发送问题" disabled={!canSubmit} size="icon-sm" type="submit" variant="ghost">
                <SendHorizontal aria-hidden="true" />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </section>
  );
}
