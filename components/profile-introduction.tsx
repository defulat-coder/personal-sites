"use client";

import { useEffect, useState } from "react";

type ProfileIntroductionProps = {
  englishParagraphs: readonly string[];
  paragraphs: readonly string[];
};

const ENGLISH_CHARACTER_DELAY = 11;
const CHINESE_CHARACTER_DELAY = 13;
const DELETE_CHARACTER_DELAY = 4;
const PAUSE_DELAY = 280;
const PUNCTUATION_DELAY = 140;
const LANGUAGE_TRANSITION_DELAY = 720;
const CURSOR_BLINK_DELAY = 1520;
const ENGLISH_TITLE = "Hello,";
const CHINESE_TITLE = "你好，";

type DisplayPhase = "english" | "erasing" | "chinese" | "complete";

export function ProfileIntroduction({ englishParagraphs, paragraphs }: ProfileIntroductionProps) {
  const [visibleCounts, setVisibleCounts] = useState(() => paragraphs.map(() => 0));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<DisplayPhase>("english");
  const [titleVisibleCount, setTitleVisibleCount] = useState(0);
  const [titleIsTyping, setTitleIsTyping] = useState(false);

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
        await wait(title[characterIndex - 1] === "," ? PUNCTUATION_DELAY : characterDelay);
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
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showAll();
      return;
    }

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
  }, [englishParagraphs, paragraphs]);

  const displayedParagraphs = phase === "english" || phase === "erasing"
    ? englishParagraphs
    : paragraphs;
  const introductionTitle = phase === "english" || phase === "erasing" ? ENGLISH_TITLE : CHINESE_TITLE;

  return (
    <section className="curation-home__bio" aria-labelledby="profile-introduction">
      <h2 className={titleIsTyping ? "is-typing" : undefined} id="profile-introduction">
        {introductionTitle.slice(0, titleVisibleCount)}
      </h2>
      {displayedParagraphs.map((paragraph, index) => (
        <p aria-label={paragraph} className={activeIndex === index ? "is-typing" : undefined} key={paragraph}>
          <span aria-hidden="true">{paragraph.slice(0, visibleCounts[index])}</span>
        </p>
      ))}
    </section>
  );
}
