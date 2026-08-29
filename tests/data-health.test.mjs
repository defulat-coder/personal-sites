import assert from "node:assert/strict";
import test from "node:test";

import { buildDataHealth } from "../modules/data-health/status.mjs";

const now = new Date("2026-08-29T12:00:00.000Z");
const base = {
  aiNews: { ageMinutes: 5, healthy: true, lastSucceededAt: "2026-08-29T11:55:00.000Z", running: false },
  now,
  publicData: {
    askDocuments: 10,
    askFts: 10,
    curation: {
      douyin: { count: 5, latestAt: "2026-08-29T10:00:00.000Z" },
      x: { count: 5, latestAt: "2026-08-29T11:00:00.000Z" },
    },
    openSource: { count: 3, latestAt: "2026-08-28T12:00:00.000Z" },
    works: { count: 2, latestAt: "2026-08-20T12:00:00.000Z" },
  },
};

test("healthy public projections pass through one data-health interface", () => {
  const status = buildDataHealth(base);
  assert.equal(status.healthy, true);
  assert.deepEqual(status.warnings, []);
});

test("stale or inconsistent projections fail health with an actionable warning", () => {
  const status = buildDataHealth({
    ...base,
    publicData: {
      ...base.publicData,
      askFts: 9,
      curation: {
        ...base.publicData.curation,
        x: { count: 5, latestAt: "2026-08-20T11:00:00.000Z" },
      },
    },
  });
  assert.equal(status.healthy, false);
  assert.equal(status.askIndex.healthy, false);
  assert.match(status.warnings.join("\n"), /X 策展/u);
});
