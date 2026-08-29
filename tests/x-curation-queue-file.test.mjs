import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { writeJsonAtomically } from "../modules/x-sync/queue-file.mjs";

test("queue JSON is replaced atomically without leaving temporary files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "x-curation-queue-"));
  const queuePath = path.join(directory, "queue.json");
  try {
    await writeJsonAtomically(queuePath, { items: [{ id: "1" }], version: 3 });
    await writeJsonAtomically(queuePath, { items: [{ id: "2" }], version: 3 });

    assert.deepEqual(JSON.parse(await readFile(queuePath, "utf8")), {
      items: [{ id: "2" }],
      version: 3,
    });
    assert.deepEqual(await readdir(directory), ["queue.json"]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
