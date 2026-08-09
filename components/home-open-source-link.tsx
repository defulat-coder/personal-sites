import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import styles from "@/components/open-source.module.css";

export function HomeOpenSourceLink() {
  return (
    <div className={styles.feedActions}>
      <Link className={styles.homeLink} href={"/open-source" as Route}>
        开源关注
        <ArrowUpRight aria-hidden="true" />
      </Link>
      <p>持续更新</p>
    </div>
  );
}
