"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type ProfileIntroductionProps = {
  animateOnFirstHomeVisit?: boolean;
  englishParagraphs: readonly string[];
  paragraphs: readonly string[];
};

const ENGLISH_CHARACTER_DELAY = 5.5;
const CHINESE_CHARACTER_DELAY = 6.5;
const DELETE_CHARACTER_DELAY = 2;
const PAUSE_DELAY = 280;
const PUNCTUATION_DELAY = 70;
const LANGUAGE_TRANSITION_DELAY = 720;
const CURSOR_BLINK_DELAY = 1520;
const ENGLISH_TITLE = "Hello,";
const CHINESE_TITLE = "你好，";
const GREETING_CHARACTER_DELAY = 72;
const GREETING_HOLD_DELAY = 2_600;
const GREETINGS = [
  CHINESE_TITLE,
  ENGLISH_TITLE,
  "Hola,",
  "こんにちは、",
  "안녕하세요,",
  "Bonjour,",
  "नमस्ते,",
  "Ciao,",
  "Olá,",
  "Hallo,",
  "Merhaba,",
  "Привет,",
  "مرحبًا،",
  "สวัสดีครับ,",
];
const INTRODUCTION_ANIMATION_SESSION_KEY = "curation-profile-introduction-played-v3";

type DisplayPhase = "english" | "erasing" | "chinese" | "complete";

export function ProfileIntroduction({
  animateOnFirstHomeVisit = false,
  englishParagraphs,
  paragraphs,
}: ProfileIntroductionProps) {
  const englishMeasureRef = useRef<HTMLDivElement>(null);
  const chineseMeasureRef = useRef<HTMLDivElement>(null);
  const [visibleCounts, setVisibleCounts] = useState(() => (
    animateOnFirstHomeVisit
      ? paragraphs.map(() => 0)
      : paragraphs.map((paragraph) => paragraph.length)
  ));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<DisplayPhase>("complete");
  const [titleVisibleCount, setTitleVisibleCount] = useState(CHINESE_TITLE.length);
  const [titleIsTyping, setTitleIsTyping] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [reservedHeight, setReservedHeight] = useState<number | null>(null);
  const [hasCompletedInitialSequence, setHasCompletedInitialSequence] = useState(
    () => !animateOnFirstHomeVisit,
  );
  const [shouldAnimateInitialVisit] = useState(
    () => animateOnFirstHomeVisit
      && typeof window !== "undefined"
      && !window.sessionStorage.getItem(INTRODUCTION_ANIMATION_SESSION_KEY),
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    if (phase !== "complete" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const wait = (delay: number) => new Promise<void>((resolve) => {
      timeoutId = window.setTimeout(resolve, delay);
    });

    const typeGreeting = async (greeting: string) => {
      setTitleIsTyping(true);

      for (let characterIndex = 1; characterIndex <= greeting.length; characterIndex += 1) {
        if (cancelled) return;
        setTitleVisibleCount(characterIndex);
        await wait(/[，、,.!?]/u.test(greeting[characterIndex - 1]) ? PUNCTUATION_DELAY : GREETING_CHARACTER_DELAY);
      }

      setTitleIsTyping(false);
    };

    const waitForVisible = () => new Promise<void>((resolve) => {
      if (!document.hidden) {
        resolve();
        return;
      }
      const onVisibilityChange = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", onVisibilityChange);
          resolve();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
    });

    const cycleGreetings = async () => {
      let nextGreetingIndex = 1;

      while (!cancelled) {
        await wait(GREETING_HOLD_DELAY);
        if (cancelled) return;

        // 后台标签页不空转打字机定时器，回到前台再继续。
        await waitForVisible();
        if (cancelled) return;

        setGreetingIndex(nextGreetingIndex);
        setTitleVisibleCount(0);
        await typeGreeting(GREETINGS[nextGreetingIndex]);
        if (cancelled) return;

        nextGreetingIndex = (nextGreetingIndex + 1) % GREETINGS.length;
      }
    };

    void cycleGreetings();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    let observer: MutationObserver | undefined;

    const showAll = () => {
      setVisibleCounts(paragraphs.map((paragraph) => paragraph.length));
      setActiveIndex(null);
      setPhase("complete");
      setTitleVisibleCount(CHINESE_TITLE.length);
      setTitleIsTyping(false);
      setHasCompletedInitialSequence(true);
    };

    const wait = (delay: number) => new Promise<void>((resolve) => {
      timeoutId = window.setTimeout(resolve, delay);
    });

    const typeParagraphs = async (copy: readonly string[], characterDelay: number) => {
      for (let paragraphIndex = 0; paragraphIndex < copy.length; paragraphIndex += 1) {
        const paragraph = copy[paragraphIndex];
        setActiveIndex(paragraphIndex);

        for (let characterIndex = 1; characterIndex <= paragraph.length; characterIndex += 1) {
          if (cancelled) return;
          setVisibleCounts((counts) => counts.map((count, index) => (
            index === paragraphIndex ? characterIndex : count
          )));
          const character = paragraph[characterIndex - 1];
          await wait(/[，。；、.!?]/u.test(character) ? PUNCTUATION_DELAY : characterDelay);
        }

        await wait(PAUSE_DELAY);
      }
    };

    const typeTitle = async (title: string, characterDelay: number) => {
      setTitleIsTyping(true);

      for (let characterIndex = 1; characterIndex <= title.length; characterIndex += 1) {
        if (cancelled) return;
        setTitleVisibleCount(characterIndex);
        await wait(/[，、,.!?]/u.test(title[characterIndex - 1]) ? PUNCTUATION_DELAY : characterDelay);
      }

      setTitleIsTyping(false);
    };

    const eraseParagraphs = async () => {
      setPhase("erasing");

      for (let paragraphIndex = englishParagraphs.length - 1; paragraphIndex >= 0; paragraphIndex -= 1) {
        const paragraph = englishParagraphs[paragraphIndex];
        setActiveIndex(paragraphIndex);

        for (let characterIndex = paragraph.length - 1; characterIndex >= 0; characterIndex -= 1) {
          if (cancelled) return;
          setVisibleCounts((counts) => counts.map((count, index) => (
            index === paragraphIndex ? characterIndex : count
          )));
          await wait(DELETE_CHARACTER_DELAY);
        }

        await wait(PAUSE_DELAY);
      }
    };

    const eraseTitle = async () => {
      setTitleIsTyping(true);

      for (let characterIndex = ENGLISH_TITLE.length - 1; characterIndex >= 0; characterIndex -= 1) {
        if (cancelled) return;
        setTitleVisibleCount(characterIndex);
        await wait(DELETE_CHARACTER_DELAY);
      }
    };

    const playSequence = async () => {
      setPhase("english");
      setVisibleCounts(englishParagraphs.map(() => 0));
      setTitleVisibleCount(0);
      await typeTitle(ENGLISH_TITLE, ENGLISH_CHARACTER_DELAY);
      if (cancelled) return;

      await typeParagraphs(englishParagraphs, ENGLISH_CHARACTER_DELAY);
      if (cancelled) return;

      await wait(LANGUAGE_TRANSITION_DELAY);
      if (cancelled) return;

      await eraseParagraphs();
      if (cancelled) return;

      setActiveIndex(null);
      await eraseTitle();
      if (cancelled) return;

      await wait(CURSOR_BLINK_DELAY);
      if (cancelled) return;

      setPhase("chinese");
      setVisibleCounts(paragraphs.map(() => 0));
      setTitleVisibleCount(0);
      await typeTitle(CHINESE_TITLE, CHINESE_CHARACTER_DELAY);
      if (cancelled) return;

      await typeParagraphs(paragraphs, CHINESE_CHARACTER_DELAY);
      if (!cancelled) {
        setActiveIndex(null);
        setPhase("complete");
        setHasCompletedInitialSequence(true);
      }
    };

    const shouldPlay = shouldAnimateInitialVisit
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!shouldPlay) {
      showAll();
      return;
    }

    window.sessionStorage.setItem(INTRODUCTION_ANIMATION_SESSION_KEY, "true");

    if (document.querySelector(".opening-loader")) {
      observer = new MutationObserver(() => {
        if (!document.querySelector(".opening-loader")) {
          observer?.disconnect();
          void playSequence();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      void playSequence();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [englishParagraphs, paragraphs, shouldAnimateInitialVisit]);

  useLayoutEffect(() => {
    const measurements = [englishMeasureRef.current, chineseMeasureRef.current];

    const updateReservedHeight = () => {
      const nextHeight = Math.ceil(Math.max(...measurements.map((element) => (
        element?.getBoundingClientRect().height ?? 0
      ))));

      if (nextHeight > 0) {
        setReservedHeight((currentHeight) => (
          currentHeight === nextHeight ? currentHeight : nextHeight
        ));
      }
    };

    updateReservedHeight();

    const observer = new ResizeObserver(updateReservedHeight);
    measurements.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [englishParagraphs, paragraphs]);

  const displayedParagraphs = phase === "english" || phase === "erasing"
    ? englishParagraphs
    : paragraphs;
  const introductionTitle = phase === "english" || phase === "erasing"
    ? ENGLISH_TITLE
    : phase === "complete"
      ? GREETINGS[greetingIndex]
      : CHINESE_TITLE;
  const shouldReserveHeight = shouldAnimateInitialVisit && !hasCompletedInitialSequence;

  // 测量副本不随打字机逐字重渲，仅在文案变化时重建。
  const englishMeasureTree = useMemo(() => (
    <div aria-hidden="true" className="curation-home__bio-measure" ref={englishMeasureRef}>
      <h2>{ENGLISH_TITLE}</h2>
      {englishParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>
  ), [englishParagraphs]);
  const chineseMeasureTree = useMemo(() => (
    <div aria-hidden="true" className="curation-home__bio-measure" ref={chineseMeasureRef}>
      <h2>{CHINESE_TITLE}</h2>
      {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>
  ), [paragraphs]);

  return (
    <section
      aria-labelledby="profile-introduction"
      className="curation-home__bio"
      style={shouldReserveHeight && reservedHeight ? { minHeight: `${reservedHeight}px` } : undefined}
    >
      <h2 className={titleIsTyping ? "is-typing" : undefined} id="profile-introduction">
        {introductionTitle.slice(0, titleVisibleCount)}
      </h2>
      {displayedParagraphs.map((paragraph, index) => (
        <p aria-label={paragraph} className={activeIndex === index ? "is-typing" : undefined} key={paragraph}>
          <span aria-hidden="true">{paragraph.slice(0, visibleCounts[index])}</span>
        </p>
      ))}
      {englishMeasureTree}
      {chineseMeasureTree}
    </section>
  );
}
