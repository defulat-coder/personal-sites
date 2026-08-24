"use client";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import type { AskScope, AskSource } from "@/lib/ask-types";
import { ArrowUpRight, ChevronDown, Search, SendHorizontal, Square, Trash2 } from "lucide-react";
import { AnimatePresence, animate, motion } from "motion/react";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import styles from "./ask-chat.module.css";

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

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
  "ai-news": "每日动态",
  daily: "每日关注",
  "open-source": "开源关注",
};

const suggestedQuestions = [
  "最近有哪些关于 Agent 长期运行的实践？",
  "哪些开源项目值得持续关注？",
  "最近的每日关注里提到了什么检索思路？",
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
const AskMessageBubble = memo(function AskMessageBubble({ isStreamingPlaceholder, message, prefersReducedMotion }: {
  isStreamingPlaceholder: boolean;
  message: ChatMessage;
  prefersReducedMotion: boolean;
}) {
  return (
    <Message align={message.role === "user" ? "end" : "start"} className={styles.message}>
      <MessageContent>
        {/* 对齐方向已表达说话人；铭牌只保留给读屏，不占垂直节奏。 */}
        <MessageHeader className="sr-only">
          {message.role === "user" ? "你" : "归档助手"}
        </MessageHeader>
        {message.content ? (
          <Bubble align={message.role === "user" ? "end" : "start"} variant={message.role === "user" ? "default" : "ghost"}>
            <BubbleContent aria-live={message.role === "assistant" ? "polite" : undefined} className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
              {/* 流式期间渲染纯文本：Markdown 组件对每个 delta 全量重解析是 O(n²)，
                  落定（isComplete）后才挂 ReactMarkdown；bubble 的 pre-wrap 保证换行不丢。 */}
              {message.role === "assistant" && message.isComplete
                ? <AskAnswerMarkdown source={message.content} />
                : message.content}
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
            {/* 回答落定后来源逐条阶梯入场；减少动态时直接静态呈现。 */}
            <ol aria-label="回答来源" className={styles.citations}>
              {message.citations.map((source, sourceIndex) => (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: "0.3rem" }}
                  key={source.id}
                  transition={{
                    delay: prefersReducedMotion ? 0 : sourceIndex * 0.045,
                    duration: 0.22,
                    ease: MESSAGE_ENTER_EASE,
                  }}
                >
                  <a className={styles.citation} href={source.sourceUrl}>
                    <span>【{sourceIndex + 1}】{source.title}{source.section ? ` · ${source.section}` : ""}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </motion.li>
              ))}
            </ol>
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
});

const MESSAGE_ENTER_DURATION = 0.24;
const EMPTY_ENTER_DURATION = 0.32;
const MESSAGE_ENTER_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const CLEAR_ITEM_DURATION = 0.42;
const CLEAR_STAGGER = 0.07;
const CLEAR_EXIT_EASE: [number, number, number, number] = [0.5, 0, 0.75, 0.4];
const PLANE_LAUNCH_DURATION = 0.52;
const PLANE_LAUNCH_EASE: [number, number, number, number] = [0.45, 0, 0.75, 0.4];
const PLANE_LAUNCH_TIMES = [0, 0.16, 0.34, 0.62, 1];

// 进出场由 Motion 驱动：enter 复刻旧 message-enter（240ms 上浮淡入），
// exit 复刻旧 message-clear-wipe（420ms 自下而上收没 + 模糊），
// exitOrder 按"最新先走"注入阶梯延迟；减少动态时进出场都立即落定。
function AskMessageItem({ exitOrder, isStreamingPlaceholder, message, prefersReducedMotion }: {
  exitOrder: number;
  isStreamingPlaceholder: boolean;
  message: ChatMessage;
  prefersReducedMotion: boolean;
}) {
  return (
    <MotionMessageScrollerItem
      animate={{ clipPath: "inset(0% 0% 0% 0%)", filter: "blur(0px)", opacity: 1, y: "0rem" }}
      className={styles.messageItem}
      exit={{
        clipPath: "inset(100% 0% 0% 0%)",
        filter: "blur(3px)",
        opacity: 0,
        transition: prefersReducedMotion
          ? { duration: 0 }
          : { delay: exitOrder * CLEAR_STAGGER, duration: CLEAR_ITEM_DURATION, ease: CLEAR_EXIT_EASE },
        y: "-0.4rem",
      }}
      initial={prefersReducedMotion
        ? false
        : { clipPath: "inset(0% 0% 0% 0%)", filter: "blur(0px)", opacity: 0, y: "0.4rem" }}
      messageId={message.id}
      scrollAnchor={message.role === "user"}
      transition={{ duration: MESSAGE_ENTER_DURATION, ease: MESSAGE_ENTER_EASE }}
    >
      <AskMessageBubble isStreamingPlaceholder={isStreamingPlaceholder} message={message} prefersReducedMotion={prefersReducedMotion} />
    </MotionMessageScrollerItem>
  );
}

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [scope, setScope] = useState<AskScope>("all");
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const planeRef = useRef<SVGSVGElement | null>(null);
  const planeControls = useRef<ReturnType<typeof animate> | null>(null);
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

  useEffect(() => () => {
    planeControls.current?.stop();
    // 卸载（离开路由）时中止进行中的流式请求，避免对已卸载组件空跑完整回答。
    requestController.current?.abort();
  }, []);

  // 清空对话：移除消息触发 AnimatePresence 逐条收没（最新一条先走，阶梯延迟由
  // exitOrder 注入），全部收没后由 onExitComplete 重置剩余状态；减少动态时立即清空。
  const clearChat = () => {
    if (isClearing || messages.length === 0) return;
    requestController.current?.abort();
    setMessages([]);
    if (prefersReducedMotion) {
      setUsedSuggestions([]);
      return;
    }
    setIsClearing(true);
  };

  // 全部气泡收没后才真正重置对话状态，替代原先与 CSS 时长手工对齐的 setTimeout。
  const handleMessagesExitComplete = useCallback(() => {
    setUsedSuggestions([]);
    setIsClearing(false);
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

  // 发送反馈：轨迹逐段复刻旧 CSS plane-launch 关键帧——先后蓄势、抬头，
  // 再沿弧线加速飞出、缩小淡出；控件挂在 ref 上，组件卸载时统一停止。
  const launchPlane = async () => {
    const plane = planeRef.current;
    if (!plane) return;
    const controls = animate(plane, {
      opacity: [1, 1, 1, 1, 0],
      rotate: [0, 10, -10, -18, -26],
      scale: [1, 0.9, 1.04, 0.94, 0.55],
      transformOrigin: "center",
      x: ["0rem", "-0.14rem", "0.1rem", "0.9rem", "2.6rem"],
      y: ["0rem", "0.1rem", "-0.12rem", "-0.85rem", "-2.4rem"],
    }, {
      duration: PLANE_LAUNCH_DURATION,
      ease: PLANE_LAUNCH_EASE,
      times: PLANE_LAUNCH_TIMES,
    });
    planeControls.current = controls;
    // 卸载时 stop() 会中断等待，静默即可。
    await controls.then(() => undefined, () => undefined);
  };

  const submit = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isStreaming || isLaunching || visitorId === "unavailable") return;

    // 发送反馈：纸飞机先蓄势起飞，动画落定后再进入流式流程；减少动态时跳过。
    if (!prefersReducedMotion) {
      setIsLaunching(true);
      await launchPlane();
      setIsLaunching(false);
    }

    const session = await (visitorSessionPromise.current ?? ensureVisitorSession());
    if (session.visitorId === "unavailable") return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    if (suggestedQuestions.includes(trimmedQuestion)) {
      setUsedSuggestions((current) => [...current, trimmedQuestion]);
    }
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

  const canSubmit = Boolean(question.trim() && visitorId !== "unavailable" && !isStreaming && !isLaunching && !isClearing);

  // 追问引导：回答完成后给出还没用过的建议问题，沿用空态的细线行语言；
  // 点击只填入组合器并聚焦，是否发送仍由访客决定。
  const lastMessage = messages[messages.length - 1];
  const followUpQuestions = suggestedQuestions.filter((item) => !usedSuggestions.includes(item));
  const showFollowUps = !isStreaming
    && !isClearing
    && lastMessage?.role === "assistant"
    && lastMessage.isComplete
    && Boolean(lastMessage.content)
    && followUpQuestions.length > 0;

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
            <MessageScrollerContent
              aria-busy={isStreaming}
              className={styles.messages}
              style={isClearing ? { pointerEvents: "none" } : undefined}
            >
              {messages.length === 0 && !isClearing ? (
                <MotionMessageScrollerItem
                  animate={{ opacity: 1, y: "0rem" }}
                  className={styles.emptyItem}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: "0.4rem" }}
                  messageId="ask-empty-state"
                  transition={{ duration: EMPTY_ENTER_DURATION, ease: MESSAGE_ENTER_EASE }}
                >
                  <Empty className={styles.empty}>
                    <EmptyHeader>
                      <EmptyTitle>从公开资料开始</EmptyTitle>
                      <EmptyDescription>我不会补充未公开的资料，也不会把猜测写成结论。</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent className={styles.suggestions}>
                      {suggestedQuestions.map((suggestion, suggestionIndex) => (
                        <motion.span
                          animate={{ opacity: 1, y: 0 }}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: "0.3rem" }}
                          key={suggestion}
                          transition={{
                            delay: prefersReducedMotion ? 0 : 0.15 + suggestionIndex * 0.05,
                            duration: 0.24,
                            ease: MESSAGE_ENTER_EASE,
                          }}
                        >
                          <Button onClick={() => setQuestion(suggestion)} size="sm" type="button" variant="ghost">
                            {suggestion}
                            <ArrowUpRight data-icon="inline-end" />
                          </Button>
                        </motion.span>
                      ))}
                    </EmptyContent>
                  </Empty>
                </MotionMessageScrollerItem>
              ) : null}
              <AnimatePresence onExitComplete={handleMessagesExitComplete}>
                {messages.map((message, index) => (
                  <AskMessageItem
                    exitOrder={messages.length - 1 - index}
                    isStreamingPlaceholder={isStreaming && index === messages.length - 1}
                    key={message.id}
                    message={message}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </AnimatePresence>
              {showFollowUps ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={styles.followups}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: "0.3rem" }}
                  transition={{ duration: 0.24, ease: MESSAGE_ENTER_EASE }}
                >
                  <p className={styles.followupsLabel}>继续问</p>
                  <div className={styles.suggestions}>
                    {followUpQuestions.slice(0, 2).map((suggestion) => (
                      <Button
                        key={suggestion}
                        onClick={() => {
                          setQuestion(suggestion);
                          textareaRef.current?.focus();
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {suggestion}
                        <ArrowUpRight data-icon="inline-end" />
                      </Button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton aria-label={`检索范围：${scopeLabels[scope]}`} className={styles.scopeTrigger} size="sm" type="button" variant="ghost">
                  <Search data-icon="inline-start" />
                  {scopeLabels[scope]}
                  <ChevronDown data-icon="inline-end" />
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className={styles.scopeMenu} side="top" sideOffset={8}>
                <DropdownMenuLabel>检索范围</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuRadioGroup
                    onValueChange={(value) => {
                      if (value === "all" || value === "ai-news" || value === "daily" || value === "open-source") setScope(value);
                    }}
                    value={scope}
                  >
                    {(Object.keys(scopeLabels) as AskScope[]).map((item) => (
                      <DropdownMenuRadioItem key={item} value={item}>{scopeLabels[item]}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {messages.length > 0 && !isStreaming ? (
              <InputGroupButton
                aria-label="清空对话"
                className={styles.clear}
                disabled={isClearing}
                onClick={clearChat}
                size="icon-sm"
                title="清空对话"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" />
              </InputGroupButton>
            ) : null}
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
              <InputGroupButton
                aria-label="发送问题"
                className={`${styles.send} ${isLaunching ? styles.sendLaunching : ""}`}
                disabled={!canSubmit && !isLaunching}
                size="icon-sm"
                type="submit"
                variant="ghost"
              >
                <SendHorizontal aria-hidden="true" ref={planeRef} />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </section>
  );
}
