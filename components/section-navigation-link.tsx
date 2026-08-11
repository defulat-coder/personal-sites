"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  beginSectionTransition,
  type SectionTransition,
} from "@/components/section-motion-state";
import { beginProfileTransition } from "@/components/profile-transition-state";

type SectionNavigationLinkProps = {
  "aria-current"?: "page";
  children: ReactNode;
  className: string;
  from: string;
  href: Route;
  to: string;
  transition: SectionTransition;
};

const exitDuration = 130;

export function SectionNavigationLink({
  children,
  className,
  from,
  href,
  to,
  transition,
  ...props
}: SectionNavigationLinkProps) {
  const router = useRouter();
  const timeout = useRef<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
  }, []);

  return (
    <Link
      {...props}
      className={className}
      data-transitioning={isNavigating ? "true" : undefined}
      href={href}
      onNavigate={(event) => {
        if (isNavigating || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        event.preventDefault();
        setIsNavigating(true);
        const isMobileProfileTransition = (from === "home" || to === "home")
          && window.matchMedia("(max-width: 900px)").matches;

        if (!isMobileProfileTransition) beginSectionTransition(transition);
        beginProfileTransition(from, to);
        timeout.current = window.setTimeout(() => {
          router.push(href);
        }, exitDuration);
      }}
    >
      {children}
    </Link>
  );
}
