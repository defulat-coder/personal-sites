"use client";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
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
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import type { AskScope, AskSource } from "@/lib/ask-types";
import { ArrowUpRight, Search, SendHorizontal, Square } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import styles from "./ask-chat.module.css";

// react-markdown 生态只在收到第一条回答时才需要，按需加载。
const AskAnswerMarkdown = dynamic(() => import("@/components/ask-answer-markdown").then((module) => module.AskAnswerMarkdown));

type ChatMessage = {
  citations: AskSource[];
  content: string;
  id: string;
  isComplete: boolean;
  role: "assistant" | "user";
};

const scopeLabels: Record<AskScope, string> = {
  all: "全部",
  daily: "推特点赞",
  "open-source": "开源关注",
};

const suggestedQuestions = [
  "最近有哪些关于 Agent 长期运行的实践？",
  "哪些开源项目值得持续关注？",
  "最近的推特点赞里提到了什么检索思路？",
];

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

// 单条消息气泡独立 memo：流式 delta 只更新目标 message 对象引用，
// 历史消息引用保持不变即可整体跳过重渲染（含其中的 Markdown 解析）。
const AskMessageItem = memo(function AskMessageItem({ isStreamingPlaceholder, message }: {
  isStreamingPlaceholder: boolean;
  message: ChatMessage;
}) {
  return (
    <MessageScrollerItem
      className={styles.messageItem}
      messageId={message.id}
      scrollAnchor={message.role === "user"}
    >
      <Message align={message.role === "user" ? "end" : "start"} className={styles.message}>
        <MessageContent>
          {/* 对齐方向已表达说话人；铭牌只保留给读屏，不占垂直节奏。 */}
          <MessageHeader className="sr-only">
            {message.role === "user" ? "你" : "归档助手"}
          </MessageHeader>
          {message.content ? (
            <Bubble align={message.role === "user" ? "end" : "start"} variant={message.role === "user" ? "default" : "ghost"}>
              <BubbleContent aria-live={message.role === "assistant" ? "polite" : undefined} className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
                {message.role === "assistant" ? <AskAnswerMarkdown source={message.content} /> : message.content}
              </BubbleContent>
            </Bubble>
          ) : isStreamingPlaceholder ? (
            <Marker className={styles.status} role="status">
              <MarkerIcon><Search /></MarkerIcon>
              <MarkerContent>
                {message.citations.length > 0
                  ? "已检索公开资料，正在生成回答…"
                  : "正在检索公开资料…"}
              </MarkerContent>
            </Marker>
          ) : null}
          {message.role === "assistant" && message.isComplete && message.content && message.citations.length > 0 ? (
            <MessageFooter className={styles.sources}>
              <ol aria-label="回答来源" className={styles.citations}>
                {message.citations.map((source, sourceIndex) => (
                  <li key={source.id}>
                    <a className={styles.citation} href={source.sourceUrl}>
                      <span>【{sourceIndex + 1}】{source.title}{source.section ? ` · ${source.section}` : ""}</span>
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
            </MessageFooter>
          ) : null}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
});

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<AskScope>("all");
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const shouldFollowLatest = useRef(true);
  const isProgrammaticScroll = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const visitorSessionPromise = useRef<Promise<{ conversationId: string; visitorId: string }> | null>(null);

  // 指纹只用于限流，等用户表现出提问意图（聚焦输入框或提交）后再加载计算。
  const ensureVisitorSession = useCallback(() => {
    visitorSessionPromise.current ??= (async () => {
      try {
        const { default: FingerprintJS } = await import("@fingerprintjs/fingerprintjs");
        const agent = await FingerprintJS.load();
        const result = await agent.get();
        const session = { conversationId: crypto.randomUUID(), visitorId: result.visitorId };
        setVisitorId(session.visitorId);
        return session;
      } catch {
        setVisitorId("unavailable");
        return { conversationId: "", visitorId: "unavailable" };
      }
    })();
    return visitorSessionPromise.current;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const minHeight = 48;
    const maxHeight = 112;
    textarea.style.height = "0px";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [question]);

  const scrollToLatest = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !shouldFollowLatest.current) return;

    isProgrammaticScroll.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    window.requestAnimationFrame(() => {
      isProgrammaticScroll.current = false;
    });
  }, []);

  useEffect(() => {
    if (!shouldFollowLatest.current) return;
    const frame = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [messages, scrollToLatest]);

  const updateAssistant = (id: string, update: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) => current.map((message) => message.id === id ? update(message) : message));
  };

  const submit = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isStreaming || visitorId === "unavailable") return;
    const session = await (visitorSessionPromise.current ?? ensureVisitorSession());
    if (session.visitorId === "unavailable") return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    shouldFollowLatest.current = true;
    setQuestion("");
    setIsStreaming(true);
    const controller = new AbortController();
    requestController.current = controller;
    setMessages((current) => [...current,
      { citations: [], content: trimmedQuestion, id: userId, isComplete: true, role: "user" },
      { citations: [], content: "", id: assistantId, isComplete: false, role: "assistant" },
    ]);

    try {
      const response = await fetch("/api/ask", {
        body: JSON.stringify({ conversationId: session.conversationId, question: trimmedQuestion, scope, visitorId: session.visitorId }),
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
          if (item.event === "done") {
            updateAssistant(assistantId, (message) => ({ ...message, isComplete: true }));
          }
          if (item.event === "error") {
            updateAssistant(assistantId, (message) => ({
              ...message,
              citations: [],
              content: typeof item.data.message === "string" ? item.data.message : "回答暂时不可用，请稍后重试。",
              isComplete: true,
            }));
          }
        }
        if (done) break;
      }
      updateAssistant(assistantId, (message) => ({ ...message, isComplete: true }));
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "已停止生成。"
        : error instanceof Error ? error.message : "回答暂时不可用，请稍后重试。";
      updateAssistant(assistantId, (current) => ({ ...current, citations: [], content: message, isComplete: true }));
    } finally {
      requestController.current = null;
      setIsStreaming(false);
    }
  };

  const canSubmit = Boolean(question.trim() && visitorId !== "unavailable" && !isStreaming);

  return (
    <section aria-label="问一问" className={`curation-home__feed ${styles.root} site-section-motion`}>
      <ContentSectionNavigation current="ask" />

      <MessageScrollerProvider autoScroll={false} defaultScrollPosition="end">
        <MessageScroller className={styles.scroller}>
          <MessageScrollerViewport
            aria-label="问答记录"
            className={styles.viewport}
            onKeyDown={(event) => {
              if (["ArrowUp", "Home", "PageUp", " "].includes(event.key)) {
                shouldFollowLatest.current = false;
              }
            }}
            onScroll={(event) => {
              if (isProgrammaticScroll.current) return;
              const viewport = event.currentTarget;
              shouldFollowLatest.current = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 24;
            }}
            onTouchMove={() => {
              shouldFollowLatest.current = false;
            }}
            onWheel={(event) => {
              if (event.deltaY < 0) shouldFollowLatest.current = false;
            }}
            ref={viewportRef}
          >
            <MessageScrollerContent aria-busy={isStreaming} className={styles.messages}>
              {messages.length === 0 ? (
                <MessageScrollerItem className={styles.emptyItem} messageId="ask-empty-state">
                  <Empty className={styles.empty}>
                    <EmptyHeader>
                      <EmptyTitle>从公开资料开始</EmptyTitle>
                      <EmptyDescription>我不会补充未公开的资料，也不会把猜测写成结论。</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent className={styles.suggestions}>
                      {suggestedQuestions.map((suggestion) => (
                        <Button key={suggestion} onClick={() => setQuestion(suggestion)} size="sm" type="button" variant="ghost">
                          {suggestion}
                          <ArrowUpRight data-icon="inline-end" />
                        </Button>
                      ))}
                    </EmptyContent>
                  </Empty>
                </MessageScrollerItem>
              ) : null}
              {messages.map((message, index) => (
                <AskMessageItem
                  isStreamingPlaceholder={isStreaming && index === messages.length - 1}
                  key={message.id}
                  message={message}
                />
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton
            aria-label="回到最新消息"
            behavior={prefersReducedMotion ? "auto" : "smooth"}
            className={styles.scrollToLatest}
            onClick={() => {
              shouldFollowLatest.current = true;
              window.requestAnimationFrame(scrollToLatest);
            }}
          />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <InputGroup className={styles.composer}>
          <InputGroupAddon align="block-start" className={styles.composerScopes}>
            <ToggleGroup
              aria-label="检索范围"
              className={styles.scopeGroup}
              onValueChange={(value) => {
                if (value === "all" || value === "daily" || value === "open-source") setScope(value);
              }}
              size="sm"
              type="single"
              value={scope}
              variant="outline"
            >
              {(Object.keys(scopeLabels) as AskScope[]).map((item) => (
                <ToggleGroupItem className={styles.scopeItem} key={item} value={item}>
                  {scopeLabels[item]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </InputGroupAddon>
          <InputGroupTextarea
            aria-label="输入问题"
            disabled={visitorId === "unavailable" || isStreaming}
            onChange={(event) => setQuestion(event.target.value)}
            onFocus={() => void ensureVisitorSession()}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={visitorId === "unavailable" ? "无法建立浏览器会话，请刷新后重试" : "问问这些公开资料…"}
            ref={textareaRef}
            rows={1}
            value={question}
          />
          <InputGroupAddon align="block-end" className={styles.composerFooter}>
            {isStreaming ? (
              <InputGroupButton
                aria-label="停止生成"
                className={styles.send}
                onClick={() => requestController.current?.abort()}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Square aria-hidden="true" />
              </InputGroupButton>
            ) : (
              <InputGroupButton aria-label="发送问题" className={styles.send} disabled={!canSubmit} size="icon-sm" type="submit" variant="ghost">
                <SendHorizontal aria-hidden="true" />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </section>
  );
}
