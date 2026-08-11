import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readPersistableSessionFile } from "@/lib/ask-session-file";

describe("readPersistableSessionFile", () => {
  it("skips a Pi session path that has not been created yet", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ask-session-file-"));
    try {
      await expect(readPersistableSessionFile(path.join(directory, "pending.jsonl"))).resolves.toBeUndefined();
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("reads an existing Pi session file", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ask-session-file-"));
    const sessionFile = path.join(directory, "session.jsonl");
    try {
      await writeFile(sessionFile, "{\"type\":\"session\"}\n");
      await expect(readPersistableSessionFile(sessionFile)).resolves.toEqual(Buffer.from("{\"type\":\"session\"}\n"));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
