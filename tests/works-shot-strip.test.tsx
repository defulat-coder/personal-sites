import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorksShotStrip } from "@/components/works-shot-strip";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
}));

describe("WorksShotStrip", () => {
  afterEach(cleanup);

  it("prioritizes only the two shots visible in the initial viewport", () => {
    render(
      <WorksShotStrip
        shots={[
          { label: "每日动态", src: "/feed.jpg" },
          { label: "每日关注", src: "/curation.jpg" },
          { label: "开源关注", src: "/open-source.jpg" },
          { label: "问一问", src: "/ask.jpg" },
        ]}
        workTitle="这个站点本身"
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images.map((image) => image.getAttribute("loading"))).toEqual([
      "eager",
      "eager",
      "lazy",
      "lazy",
    ]);
    expect(images.map((image) => image.getAttribute("fetchpriority"))).toEqual([
      "high",
      "high",
      null,
      null,
    ]);
    const dailyButton = screen.getByRole("button", { name: "放大查看：每日关注" });
    expect(dailyButton.contains(screen.getByRole("img", { name: "这个站点本身 · 每日关注" }))).toBe(true);
    expect(screen.getByText("每日关注")).not.toBeNull();
  });
});
