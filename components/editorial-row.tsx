import Image from "next/image";
import { ArrowRight } from "lucide-react";

import type { EditorialContentItem } from "@/lib/site-content";

type EditorialRowProps = {
  item: EditorialContentItem;
};

function RowContents({ item }: EditorialRowProps) {
  return (
    <>
      <span className="editorial-row__gradient" aria-hidden="true" />
      <span className="editorial-row__surface" aria-hidden="true" />
      <span className="editorial-row__content">
        <span className="editorial-row__image">
          <Image
            alt=""
            fill
            sizes="240px"
            src={item.image}
          />
        </span>
        <span className="editorial-row__copy">
          {"eyebrow" in item && item.eyebrow ? (
            <span className="editorial-row__eyebrow">{item.eyebrow}</span>
          ) : null}
          <span className="editorial-row__title">{item.title}</span>
          <span className="editorial-row__summary">{item.summary}</span>
        </span>
        <span className="editorial-row__arrow" aria-hidden="true">
          <ArrowRight />
        </span>
      </span>
    </>
  );
}

export function EditorialRow({ item }: EditorialRowProps) {
  if (item.url) {
    return (
      <a
        className="editorial-row"
        href={item.url}
        rel="noreferrer"
        target="_blank"
      >
        <RowContents item={item} />
      </a>
    );
  }

  return (
    <article className="editorial-row" data-editorial-row>
      <RowContents item={item} />
    </article>
  );
}
