#!/usr/bin/env python3
"""Discover authenticated Douyin favorite video URLs without exposing cookies or titles."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import yaml
from playwright.async_api import async_playwright


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sidecar", required=True, type=Path)
    parser.add_argument("--data-root", required=True, type=Path)
    parser.add_argument("--idle-rounds", type=int, default=10)
    parser.add_argument("--max-scrolls", type=int, default=600)
    return parser.parse_args()


def item_from_url(url: str) -> dict[str, str] | None:
    parts = [part for part in urlparse(url).path.split("/") if part]
    if len(parts) < 2 or parts[0] not in {"video", "note"} or not parts[1].isdigit():
        return None
    return {"id": parts[1], "kind": parts[0], "url": f"https://www.douyin.com/{parts[0]}/{parts[1]}"}


async def discover(cookies: dict[str, str], *, idle_rounds: int, max_scrolls: int) -> list[dict[str, str]]:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context()
        await context.add_cookies([
            {"name": name, "value": value, "domain": ".douyin.com", "path": "/"}
            for name, value in cookies.items()
            if name
        ])
        page = await context.new_page()
        await page.goto(
            "https://www.douyin.com/user/self?showTab=favorite_collection",
            wait_until="domcontentloaded",
            timeout=60_000,
        )
        await page.wait_for_timeout(4_000)
        if await page.get_by_text("登录后即可观看喜欢、收藏的视频", exact=False).count():
            raise RuntimeError("抖音登录态已失效，请重新登录。")

        items: dict[str, dict[str, str]] = {}
        idle = 0
        for _ in range(max_scrolls):
            hrefs = await page.locator('a[href*="/video/"], a[href*="/note/"]').evaluate_all(
                "elements => elements.map(element => element.href)"
            )
            before = len(items)
            for href in hrefs:
                item = item_from_url(href)
                if item:
                    items[f"{item['kind']}:{item['id']}"] = item
            idle = idle + 1 if len(items) == before else 0
            if idle >= idle_rounds:
                break
            await page.evaluate("""() => {
              const candidates = [document.scrollingElement, ...document.querySelectorAll('*')]
                .filter(Boolean)
                .filter(element => element.scrollHeight > element.clientHeight + 200)
                .sort((left, right) => right.scrollHeight - left.scrollHeight)
              const target = candidates[0]
              if (target) target.scrollTop = target.scrollHeight
            }""")
            await page.mouse.wheel(0, 5_000)
            await page.wait_for_timeout(900)
        await browser.close()
        return list(items.values())


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return fallback


def downloaded_ids(manifest_path: Path) -> set[str]:
    if not manifest_path.exists():
        return set()
    ids = set()
    for line in manifest_path.read_text().splitlines():
        if line.strip():
            ids.add(str(json.loads(line).get("aweme_id") or ""))
    return ids


async def main() -> None:
    args = parse_args()
    sidecar = args.sidecar.resolve()
    data_root = args.data_root.resolve()
    cookies = json.loads((sidecar / ".cookies.json").read_text())
    discovered = await discover(cookies, idle_rounds=args.idle_rounds, max_scrolls=args.max_scrolls)
    now = datetime.now(timezone.utc).isoformat()
    index_path = data_root / "favorite-index.json"
    previous = read_json(index_path, {"items": []})
    previous_by_key = {f"{item['kind']}:{item['id']}": item for item in previous["items"]}
    merged = []
    for item in discovered:
        key = f"{item['kind']}:{item['id']}"
        merged.append({
            **item,
            "firstSeenAt": previous_by_key.get(key, {}).get("firstSeenAt", now),
            "lastSeenAt": now,
        })
    data_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    index_path.write_text(json.dumps({"items": merged, "syncedAt": now, "version": 1}, ensure_ascii=False, indent=2) + "\n")
    os.chmod(index_path, 0o600)

    downloaded = downloaded_ids(data_root / "downloads/download_manifest.jsonl")
    pending = [item["url"] for item in merged if item["kind"] == "video" and item["id"] not in downloaded]
    (data_root / "pending-video-urls.json").write_text(json.dumps(pending, ensure_ascii=False, indent=2) + "\n")
    os.chmod(data_root / "pending-video-urls.json", 0o600)

    config = yaml.safe_load((sidecar / "config.yml").read_text())
    config["link"] = pending
    config["mode"] = ["post"]
    (sidecar / "config-incremental.yml").write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False))
    os.chmod(sidecar / "config-incremental.yml", 0o600)
    print(json.dumps({
        "discovered": len(merged),
        "new": sum(1 for item in merged if f"{item['kind']}:{item['id']}" not in previous_by_key),
        "pendingVideos": len(pending),
        "videoItems": sum(1 for item in merged if item["kind"] == "video"),
        "noteItems": sum(1 for item in merged if item["kind"] == "note"),
    }))


if __name__ == "__main__":
    asyncio.run(main())
